import { test } from "node:test";
import assert from "node:assert/strict";
import { WRITER_METADATA_ID, WRITER_METADATA_KEY } from "../lib/google-writer";
import { GoogleSheetsRepository } from "../lib/sheets";
import { googleClient } from "../lib/google-connection";
import { encodeDocument } from "../lib/sheets-document";
import { seedState } from "../lib/domain";
import { mutateState } from "../lib/mutations";
function fake(conflict = false) {
  const initial = seedState();
  initial.mode = "sheets";
  let rows = encodeDocument(initial, "initial"),
    reads = 0,
    writes = 0;
  const getClient = async () => ({
    config: { spreadsheetId: "copy" },
    sheets: {
      spreadsheets: {
        get: async () => ({
          data: {
            sheets: [{ properties: { title: "08_앱데이터", sheetId: 777 } }],
          },
        }),
        developerMetadata: {
          get: async () => ({
            data: {
              metadataId: WRITER_METADATA_ID,
              metadataKey: WRITER_METADATA_KEY,
              metadataValue: "test-writer",
              location: { sheetId: 777 },
            },
          }),
        },
        values: {
          get: async () => {
            reads++;
            if (conflict && reads === 2)
              rows = encodeDocument(
                { ...initial, revision: 1 },
                "other-device",
              );
            return { data: { values: rows } };
          },
        },
        batchUpdate: async ({
          requestBody,
        }: {
          requestBody: {
            requests: {
              updateCells?: {
                range: { sheetId: number };
                rows: {
                  values: {
                    userEnteredValue: {
                      stringValue?: string;
                      numberValue?: number;
                    };
                  }[];
                }[];
              };
            }[];
          };
        }) => {
          writes++;
          assert.equal(requestBody.requests.length, 1);
          const update = requestBody.requests[0].updateCells!;
          assert.equal(update.range.sheetId, 777);
          rows = update.rows.map((r) =>
            r.values.map(
              (c) =>
                c.userEnteredValue.numberValue ??
                c.userEnteredValue.stringValue ??
                "",
            ),
          );
          return { data: {} };
        },
      },
    },
  });
  return {
    repo: new GoogleSheetsRepository(
      getClient as unknown as typeof googleClient,
      async () => {},
      async () => "test-writer",
      async (_key, fn) => fn(),
    ),
    writes: () => writes,
  };
}
test("Google repository writes verified data and deduplicates request after lost response", async () => {
  const f = fake();
  const saved = await f.repo.update(
    (s) =>
      mutateState(s, {
        kind: "delete",
        entity: "expense",
        ids: [s.expenses[0].id],
        revision: 0,
      }),
    "same-request",
  );
  assert.equal(saved.expenses[0].active, false);
  assert.equal(saved.revision, 1);
  const again = await f.repo.update(() => {
    throw Error("must not run mutation again");
  }, "same-request");
  assert.equal(again.revision, 1);
  assert.equal(f.writes(), 1);
});
test("Google repository detects external revision change before writing", async () => {
  const f = fake(true);
  await assert.rejects(
    () => f.repo.update((s) => ({ ...s, revision: s.revision + 1 }), "request"),
    /충돌/,
  );
  assert.equal(f.writes(), 0);
});
test("different installation cannot write even when revision matches", async () => {
  const f = fake();
  (f.repo as unknown as { writer: () => Promise<string> }).writer = async () =>
    "other-writer";
  await assert.rejects(
    () => f.repo.update((s) => ({ ...s, revision: s.revision + 1 }), "request"),
    /소유권/,
  );
  assert.equal(f.writes(), 0);
});
test("first connection creates writer ownership and app data in one batch", async () => {
  let rows: (string | number)[][] = [],
    sheetId: number | null = null,
    owner: any = null,
    writes = 0,
    activated = false;
  const getClient = async () => ({
    config: { spreadsheetId: "copy" },
    sheets: {
      spreadsheets: {
        get: async () => ({
          data: {
            sheets:
              sheetId === null
                ? []
                : [{ properties: { title: "08_앱데이터", sheetId } }],
            developerMetadata: owner ? [owner] : [],
          },
        }),
        developerMetadata: {
          get: async () => {
            if (!owner)
              throw Object.assign(new Error("not found"), { code: 404 });
            return { data: owner };
          },
        },
        values: { get: async () => ({ data: { values: rows } }) },
        batchUpdate: async ({
          requestBody,
        }: {
          requestBody: { requests: any[] };
        }) => {
          writes++;
          assert.equal(requestBody.requests.length, 3);
          sheetId = requestBody.requests[0].addSheet.properties.sheetId;
          const metadata =
            requestBody.requests[1].createDeveloperMetadata.developerMetadata;
          assert.equal(metadata.metadataId, WRITER_METADATA_ID);
          assert.equal(metadata.metadataValue, "first-writer");
          owner = metadata;
          rows = requestBody.requests[2].updateCells.rows.map((r: any) =>
            r.values.map(
              (v: any) =>
                v.userEnteredValue.numberValue ??
                v.userEnteredValue.stringValue,
            ),
          );
          return { data: {} };
        },
      },
    },
  });
  const repo = new GoogleSheetsRepository(
    getClient as unknown as typeof googleClient,
    async () => {},
    async () => "first-writer",
    async (_key, fn) => fn(),
    async () => {
      activated = true;
    },
  );
  const source = seedState();
  source.mode = "local";
  const result = await repo.initialize(source);
  assert.equal(result.mode, "sheets");
  assert.equal(activated, true);
  assert.equal(writes, 1);
  const other = new GoogleSheetsRepository(
    getClient as unknown as typeof googleClient,
    async () => {},
    async () => "other-writer",
    async (_key, fn) => fn(),
    async () => {},
  );
  await assert.rejects(() => other.initialize(), /소유권/);
  assert.equal(writes, 1);
});
