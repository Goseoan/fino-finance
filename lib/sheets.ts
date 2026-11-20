import { createHash } from "node:crypto";
import { exportTables, type ExportTable } from "./excel-export";
import { parseHistoricalAssets } from "./historical-assets";
import {
  googleClient,
  readGoogleConfig,
  writePrivate,
  enableGoogle,
  disconnectGoogle,
} from "./google-connection";
import { migrateSource, type SourceSheet } from "./migration";
import { State, stateSchema } from "./domain";
import {
  APP_SHEET,
  assertWriteTarget,
  encodeDocument,
  decodeDocument,
} from "./sheets-document";
import {
  installationWriter,
  withWriterLock,
  type WriterLock,
  WRITER_METADATA_ID,
  WRITER_METADATA_KEY,
} from "./google-writer";
import { backupState } from "./backups";
const queueHost = globalThis as unknown as { googleQueue?: Promise<unknown> };
async function serialized<T>(fn: () => Promise<T>) {
  const task = (queueHost.googleQueue ?? Promise.resolve()).then(fn);
  queueHost.googleQueue = task.catch(() => {});
  return task;
}
export class GoogleSheetsRepository {
  constructor(
    private getClient: typeof googleClient = googleClient,
    private cache: (state: State) => Promise<void> = (state) =>
      writePrivate("actual.json", { ...state, mode: "local" }),
    private writer: () => Promise<string> = installationWriter,
    private lock: WriterLock = withWriterLock,
    private activate: () => Promise<void> = enableGoogle,
  ) {}
  async metadata() {
    const { sheets, config } = await this.getClient();
    const r = await sheets.spreadsheets.get({
      spreadsheetId: config.spreadsheetId,
      fields: "properties(title),sheets(properties)",
    });
    return r.data;
  }
  async readLegacy() {
    const { sheets, config } = await this.getClient();
    const names = [
      "02_자산현황",
      "03_대출관리",
      "01_월고정지출",
      "05_이력분석",
      "06_설정·가이드",
    ];
    const ranges = [
      "'02_자산현황'!A1:L80",
      "'03_대출관리'!A1:M40",
      "'01_월고정지출'!A1:M120",
      "'05_이력분석'!A1:L45",
      "'06_설정·가이드'!A1:B8",
    ];
    const r = await sheets.spreadsheets.values.batchGet({
      spreadsheetId: config.spreadsheetId,
      ranges,
      valueRenderOption: "UNFORMATTED_VALUE",
      dateTimeRenderOption: "FORMATTED_STRING",
    });
    return migrateSource(
      names.map((name, i) => ({
        name,
        rows: r.data.valueRanges?.[i]?.values ?? [],
      })) as SourceSheet[],
    );
  }
  async readHistoricalAssets(assets: State["assets"]) {
    const { sheets, config } = await this.getClient();
    const meta = await this.metadata();
    const names = (meta.sheets ?? [])
      .map((s) => s.properties?.title ?? "")
      .filter((name) => /^\d{8}$/.test(name))
      .sort();
    if (names.length > 200) throw Error("날짜 탭이 너무 많습니다");
    const aliasRows =
      (
        await sheets.spreadsheets.values.get({
          spreadsheetId: config.spreadsheetId,
          range: "'02_자산현황'!A2:D500",
          valueRenderOption: "UNFORMATTED_VALUE",
        })
      ).data.values ?? [];
    const aliases = assets.map((a) => ({
      ...a,
      name: String(aliasRows.find((row) => row[0] === a.id)?.[3] ?? a.name),
    }));
    const tabs: SourceSheet[] = [];
    for (let start = 0; start < names.length; start += 40) {
      const batch = names.slice(start, start + 40);
      const response = await sheets.spreadsheets.values.batchGet({
        spreadsheetId: config.spreadsheetId,
        ranges: batch.map((name) => `'${name}'!A1:K1000`),
        valueRenderOption: "UNFORMATTED_VALUE",
        dateTimeRenderOption: "FORMATTED_STRING",
      });
      tabs.push(
        ...batch.map((name, i) => ({
          name,
          rows: response.data.valueRanges?.[i]?.values ?? [],
        })),
      );
    }
    return parseHistoricalAssets(tabs, assets, aliases);
  }
  private async document() {
    const { sheets, config } = await this.getClient();
    const meta = await this.metadata();
    let owner;
    try {
      owner = (
        await sheets.spreadsheets.developerMetadata.get({
          spreadsheetId: config.spreadsheetId,
          metadataId: WRITER_METADATA_ID,
        })
      ).data;
    } catch (e) {
      const failure = e as { code?: number; response?: { status?: number } };
      if (failure.code !== 404 && failure.response?.status !== 404) throw e;
    }

    const sheet = meta.sheets?.find(
      (s) => s.properties?.title === APP_SHEET,
    )?.properties;
    if (!sheet)
      return {
        doc: null,
        sheetId: null,
        owner,
      };
    const r = await sheets.spreadsheets.values.get({
      spreadsheetId: config.spreadsheetId,
      range: `'${APP_SHEET}'!A1:D5000`,
      valueRenderOption: "UNFORMATTED_VALUE",
    });
    return {
      doc: decodeDocument(r.data.values ?? []),
      owner,
      sheetId: sheet.sheetId!,
    };
  }
  async read() {
    const { doc } = await this.document();
    if (!doc) throw Error("앱 전용 저장소를 먼저 연결해 주세요");
    const state = { ...doc.state, mode: "sheets" as const };
    await this.cache(state);
    return state;
  }
  private async write(
    state: State,
    requestId: string,
    sheetId: number | null,
    claim = false,
    reports?: ExportTable[],
  ) {
    const { sheets, config } = await this.getClient();
    assertWriteTarget(config.spreadsheetId, APP_SHEET);
    const target = sheetId ?? Math.floor(Math.random() * 1_000_000_000) + 1;
    const rows = encodeDocument({ ...state, mode: "sheets" }, requestId);
    const readable =
      reports?.flatMap((table) => [
        [table.name],
        table.headers,
        ...table.rows,
        [],
      ]) ?? [];
    if (readable.length > 5000)
      throw Error(
        "Google 조회용 표가 5,000행을 초과했습니다. 엑셀 내보내기를 사용하세요.",
      );
    const properties = reports
      ? (await this.metadata()).sheets?.find(
          (s) => s.properties?.sheetId === target,
        )?.properties
      : undefined;
    const reportRequests = reports
      ? [
          {
            updateSheetProperties: {
              properties: {
                sheetId: target,
                gridProperties: {
                  columnCount: Math.max(
                    18,
                    properties?.gridProperties?.columnCount ?? 4,
                  ),
                },
              },
              fields: "gridProperties.columnCount",
            },
          },
          {
            updateCells: {
              range: {
                sheetId: target,
                startRowIndex: 0,
                endRowIndex: 5000,
                startColumnIndex: 5,
                endColumnIndex: 18,
              },
              rows: readable.map((row) => ({
                values: row.map((v) => ({
                  userEnteredValue:
                    v == null
                      ? {}
                      : typeof v === "number"
                        ? { numberValue: v }
                        : { stringValue: v },
                })),
              })),
              fields: "userEnteredValue",
            },
          },
        ]
      : [];

    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: config.spreadsheetId,
      requestBody: {
        requests: [
          ...(sheetId === null
            ? [
                {
                  addSheet: {
                    properties: {
                      sheetId: target,
                      title: APP_SHEET,
                      gridProperties: { rowCount: 5000, columnCount: 4 },
                    },
                  },
                },
              ]
            : []),
          ...(claim
            ? [
                {
                  createDeveloperMetadata: {
                    developerMetadata: {
                      metadataId: WRITER_METADATA_ID,
                      metadataKey: WRITER_METADATA_KEY,
                      metadataValue: await this.writer(),
                      location: { sheetId: target },
                      visibility: "DOCUMENT",
                    },
                  },
                },
              ]
            : []),
          {
            updateCells: {
              range: {
                sheetId: target,
                startRowIndex: 0,
                endRowIndex: 5000,
                startColumnIndex: 0,
                endColumnIndex: 4,
              },
              rows: rows.map((row) => ({
                values: row.map((v) => ({
                  userEnteredValue:
                    typeof v === "number"
                      ? { numberValue: v }
                      : { stringValue: v },
                })),
              })),
              fields: "userEnteredValue",
            },
          },
          ...reportRequests,
        ],
      },
    });
    if (reports) {
      const result = await sheets.spreadsheets.values.get({
        spreadsheetId: config.spreadsheetId,
        range: `'${APP_SHEET}'!F1:R5000`,
        valueRenderOption: "UNFORMATTED_VALUE",
      });
      const actual = result.data.values ?? [];
      const normalize = (rows: unknown[][]) => {
        const clean = rows.map((row) => {
          const r = row.map((v) => v ?? "");
          while (r.length && r.at(-1) === "") r.pop();
          return r;
        });
        while (clean.length && !clean.at(-1)!.length) clean.pop();
        return JSON.stringify(clean);
      };
      if (normalize(actual) !== normalize(readable))
        throw Error("Google 조회용 표 검증 실패");
    }
    const verified = await this.document();
    if (
      verified.doc?.requestId !== requestId ||
      verified.doc.state.revision !== state.revision
    )
      throw Error("Google 저장 후 확인 실패. 다시 불러와 확인하세요");
    await this.assertOwner(verified.owner, verified.sheetId);
    const saved = { ...verified.doc.state, mode: "sheets" as const };
    await this.cache(saved);
    return saved;
  }
  private execute<T>(fn: () => Promise<T>) {
    return serialized(async () => {
      const { config } = await this.getClient();
      return this.lock(config.spreadsheetId, fn);
    });
  }
  private async assertOwner(
    owner:
      | {
          metadataKey?: string | null;
          metadataValue?: string | null;
          location?: { sheetId?: number | null } | null;
        }
      | undefined
      | null,
    sheetId: number | null,
  ) {
    if (
      !owner ||
      owner.metadataKey !== WRITER_METADATA_KEY ||
      owner.metadataValue !== (await this.writer()) ||
      owner.location?.sheetId !== sheetId
    )
      throw Error(
        "쓰기 충돌: 이 저장소의 쓰기 소유권이 다른 설치에 있거나 아직 등록되지 않았습니다. 처음 연결한 설치를 사용하세요.",
      );
  }
  async initialize(localSeed?: State) {
    return this.execute(async () => {
      const { doc, sheetId, owner } = await this.document();
      let state: State;
      if (doc) {
        if (localSeed)
          throw Error(
            "이미 Google 앱 기록이 있습니다. Google 기존 기록을 선택하거나 백업 복원을 사용하세요.",
          );
        if (owner) await this.assertOwner(owner, sheetId);
        else {
          const { sheets, config } = await this.getClient();
          assertWriteTarget(config.spreadsheetId, APP_SHEET);
          await backupState(doc.state, "before-writer-claim");
          await sheets.spreadsheets.batchUpdate({
            spreadsheetId: config.spreadsheetId,
            requestBody: {
              requests: [
                {
                  createDeveloperMetadata: {
                    developerMetadata: {
                      metadataId: WRITER_METADATA_ID,
                      metadataKey: WRITER_METADATA_KEY,
                      metadataValue: await this.writer(),
                      location: { sheetId: sheetId! },
                      visibility: "DOCUMENT",
                    },
                  },
                },
              ],
            },
          });
          await this.assertOwner((await this.document()).owner, sheetId);
        }
        state = { ...doc.state, mode: "sheets" };
      } else {
        const legacy = localSeed ?? (await this.readLegacy());
        state = {
          ...legacy,
          mode: "sheets",
          updatedAt: new Date().toISOString(),
        };
        await backupState(state, "before-google-initialize");
        if (owner) await this.assertOwner(owner, sheetId);
        state = await this.write(state, crypto.randomUUID(), sheetId, !owner);
      }
      await this.activate();
      await this.cache(state);
      return state;
    });
  }
  /** Explicit manual export only. Never selected by ordinary state reads/writes. */
  async previewExport() {
    const { doc, owner, sheetId } = await this.document();
    if (owner) await this.assertOwner(owner, sheetId);
    if (doc && !owner) throw Error("쓰기 소유권을 확인할 수 없습니다");
    return {
      fingerprint: doc
        ? createHash("sha256").update(JSON.stringify(doc)).digest("hex")
        : null,
      remoteRevision: doc?.state.revision ?? null,
    };
  }
  async exportLocal(local: State, expected: string | null, requestId: string) {
    return this.execute(async () => {
      const initial = await this.document();
      if (initial.owner) await this.assertOwner(initial.owner, initial.sheetId);
      if (initial.doc && !initial.owner)
        throw Error("쓰기 소유권을 확인할 수 없습니다");
      if (initial.doc?.requestId === requestId) return initial.doc.state;
      const fingerprint = initial.doc
        ? createHash("sha256").update(JSON.stringify(initial.doc)).digest("hex")
        : null;
      if (fingerprint !== expected)
        throw Error("Google 저장 충돌: 미리보기를 다시 확인하세요");
      if (initial.doc)
        await backupState(initial.doc.state, "before-manual-google-export");
      const next = stateSchema.parse({
        ...local,
        mode: "sheets",
        revision: (initial.doc?.state.revision ?? -1) + 1,
        lastRequestId: requestId,
      });
      const check = await this.document();
      const current = check.doc
        ? createHash("sha256").update(JSON.stringify(check.doc)).digest("hex")
        : null;
      if (current !== fingerprint || check.sheetId !== initial.sheetId)
        throw Error("Google 저장 충돌: 미리보기를 다시 확인하세요");
      return this.write(
        next,
        requestId,
        initial.sheetId,
        !initial.owner,
        exportTables(local),
      );
    });
  }
  async disconnect() {
    return this.execute(async () => {
      const config = await readGoogleConfig();
      if (config?.enabled) await this.read().catch(() => null);
      await disconnectGoogle();
    });
  }
  async update(fn: (state: State) => State, requestId = crypto.randomUUID()) {
    return this.execute(async () => {
      const initial = await this.document();
      await this.assertOwner(initial.owner, initial.sheetId);
      if (!initial.doc) throw Error("Google 앱 저장소가 없습니다");
      if (initial.doc.requestId === requestId)
        return { ...initial.doc.state, mode: "sheets" as const };
      const before = { ...initial.doc.state, mode: "sheets" as const };
      const next = stateSchema.parse(fn(before));
      if (next.revision === before.revision) return before;
      await backupState(before, "before-google-save");
      const check = await this.document();
      if (
        check.doc?.state.revision !== before.revision ||
        check.doc?.requestId !== initial.doc.requestId
      )
        throw Error("Google 저장 충돌: 시트가 다른 곳에서 변경되었습니다");
      await this.assertOwner(check.owner, check.sheetId);
      return this.write(next, requestId, initial.sheetId);
    });
  }
}
