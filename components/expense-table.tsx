"use client";
import { EXPENSE_PURPOSES, expensePurpose } from "@/lib/expense-purpose";
import {
  orderedLabels,
  compareNamed,
  cashflowLabel,
  classificationLabel,
} from "@/lib/classification";
import { MoneyInput } from "./ui/money-input";
import { formatMoneyInput } from "@/lib/money-input";
import { useMemo, useState } from "react";
import {
  useTable,
  tableFeatures,
  rowSortingFeature,
  createSortedRowModel,
  sortFn_alphanumeric,
  sortFn_basic,
  flexRender,
  type ColumnDef,
  type SortingState,
} from "@tanstack/react-table";
import {
  ArrowDownUp,
  Pencil,
  Search,
  Plus,
  Trash2,
  ChartNoAxesCombined,
} from "lucide-react";
import { Expense, monthlyEquivalent, won } from "@/lib/domain";
import { Button } from "./ui/button";
const features = tableFeatures({
  rowSortingFeature,
  sortedRowModel: createSortedRowModel(),
  sortFns: { alphanumeric: sortFn_alphanumeric, basic: sortFn_basic },
});
export function ExpenseTable({
  expenses,
  onEdit,
  onInline,
  onDelete,
  onHistory,
  readOnly,
}: {
  expenses: Expense[];
  onEdit: (e?: Expense) => void;
  onDelete: (e: Expense) => void;
  onHistory: (e: Expense) => void;
  onInline: (e: Expense) => Promise<void>;
  readOnly: boolean;
}) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("전체");
  const [purpose, setPurpose] = useState("");
  const [sorting, setSorting] = useState<SortingState>([]);
  const data = useMemo(
    () =>
      expenses.filter(
        (e) =>
          e.name
            .toLocaleLowerCase("ko-KR")
            .includes(query.trim().toLocaleLowerCase("ko-KR")) &&
          (category === "전체" || e.category === category) &&
          (purpose === "" ||
            classificationLabel(expensePurpose(e)) === purpose),
      ),
    [expenses, query, category, purpose],
  );
  const columns = useMemo<ColumnDef<typeof features, Expense>[]>(
    () => [
      {
        accessorKey: "name",
        header: "지출 항목",
        cell: ({ row }) => (
          <div className="table-name">
            <span className="expense-symbol">
              {row.original.name.slice(0, 1)}
            </span>
            <div>
              <b>{row.original.name}</b>
              <small>{row.original.account}</small>
            </div>
          </div>
        ),
      },
      {
        accessorKey: "category",
        header: "현금흐름 구분",
        cell: ({ getValue }) => (
          <span
            className="tag expense-category"
            data-category={String(getValue())}
          >
            {cashflowLabel(String(getValue()))}
          </span>
        ),
      },
      {
        accessorKey: "amount",
        header: () => (
          <span>
            회당 납부액 <ArrowDownUp size={12} />
          </span>
        ),
        cell: ({ row, getValue }) =>
          readOnly ? (
            `${won(Number(getValue()))}원`
          ) : (
            <div className="inline-amount">
              <MoneyInput
                aria-label={`${row.original.name} 납부액`}

                min="0"
                step="1"
                defaultValue={row.original.amount}
                key={row.original.amount}
                onBlur={async (e) => {
                  const el = e.currentTarget,
                    n = Number(el.value);
                  if (!Number.isSafeInteger(n) || n < 0 || el.value === "") {
                    el.value = formatMoneyInput(row.original.amount);
                    return;
                  }
                  if (n !== row.original.amount) {
                    try {
                      await onInline({ ...row.original, amount: n });
                    } catch {
                      el.value = formatMoneyInput(row.original.amount);
                    }
                  }
                }}
              />
              <span>원</span>
            </div>
          ),
      },
      { accessorKey: "cycle", header: "납부주기" },
      {
        id: "monthly",
        accessorFn: (e) => monthlyEquivalent(e.amount, e.cycle),
        header: "월 환산 예산",
        cell: ({ getValue }) => <b>{won(Number(getValue()))}원</b>,
      },
      {
        accessorKey: "day",
        header: "납부일",
        cell: ({ getValue }) =>
          getValue() == null ? "미지정" : `${getValue()}일`,
      },
      {
        accessorKey: "active",
        header: "상태",
        cell: ({ getValue }) => (
          <span className={getValue() ? "status-active" : "muted"}>
            {getValue() ? "● 활성" : "중지"}
          </span>
        ),
      },
      {
        id: "edit",
        header: "",
        cell: ({ row }) => (
          <div className="grid-row-actions">
            <button
              className="icon-button ghost"
              aria-label={`${row.original.name} 지출 수정 이력·추이`}
              onClick={() => onHistory(row.original)}
            >
              <ChartNoAxesCombined size={15} />
            </button>
            <button
              className="icon-button ghost"
              aria-label={`${row.original.name} 수정`}
              disabled={readOnly}
              onClick={() => onEdit(row.original)}
            >
              <Pencil size={15} />
            </button>
            <button
              className="icon-button danger"
              aria-label={`${row.original.name} 지출 삭제`}
              disabled={readOnly}
              onClick={() => onDelete(row.original)}
            >
              <Trash2 size={15} />
            </button>
          </div>
        ),
      },
    ],
    [onEdit, onInline, onDelete, onHistory, readOnly],
  );
  const table = useTable({
    features,
    data,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
  });
  const rows = table.getRowModel().rows;
  const purposeLabels = orderedLabels(
    [...EXPENSE_PURPOSES, ...expenses.map((e) => expensePurpose(e))],
    EXPENSE_PURPOSES,
  );
  const groups = purposeLabels
    .map((label) => {
      const items = rows.filter(
        (r) => classificationLabel(expensePurpose(r.original)) === label,
      );
      if (!sorting.length)
        items.sort((a, b) => compareNamed(a.original, b.original));
      return {
        label,
        items,
        total: items.reduce(
          (sum, r) =>
            sum +
            (r.original.active
              ? monthlyEquivalent(r.original.amount, r.original.cycle)
              : 0),
          0,
        ),
      };
    })
    .filter((group) => group.items.length);
  return (
    <section className="panel expense-panel">
      <div className="table-toolbar">
        <div className="search-field">
          <Search size={16} />
          <input
            placeholder="지출 항목 검색"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <select
          aria-label="현금흐름 필터"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
        >
          {[
            "전체",
            "소비지출",
            "생활비예산",
            "저축·투자",
            "급여공제",
            "대출상환",
          ].map((x) => (
            <option key={x} value={x}>
              {cashflowLabel(x)}
            </option>
          ))}
        </select>
        <select
          aria-label="세부 용도 필터"
          value={purpose}
          onChange={(e) => setPurpose(e.target.value)}
        >
          <option value="">모든 용도</option>
          {purposeLabels.map((label) => (
            <option key={label}>{label}</option>
          ))}
        </select>
        <Button disabled={readOnly} onClick={() => onEdit()}>
          <Plus size={16} /> 지출 추가
        </Button>
      </div>
      <div className="desktop-table">
        <table>
          <thead>
            {table.getHeaderGroups().map((g) => (
              <tr key={g.id}>
                {g.headers.map((h) => (
                  <th
                    key={h.id}
                    aria-sort={
                      h.column.getCanSort()
                        ? h.column.getIsSorted() === "asc"
                          ? "ascending"
                          : h.column.getIsSorted() === "desc"
                            ? "descending"
                            : "none"
                        : undefined
                    }
                  >
                    {h.column.getCanSort() ? (
                      <button onClick={h.column.getToggleSortingHandler()}>
                        {flexRender(h.column.columnDef.header, h.getContext())}
                        {h.column.getIsSorted() === "asc"
                          ? " ↑"
                          : h.column.getIsSorted() === "desc"
                            ? " ↓"
                            : ""}
                      </button>
                    ) : h.id === "edit" ? (
                      <span className="sr-only">관리</span>
                    ) : (
                      flexRender(h.column.columnDef.header, h.getContext())
                    )}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          {groups.map((group) => (
            <tbody key={group.label}>
              <tr className="expense-group-heading">
                <th colSpan={columns.length} scope="rowgroup">
                  <div>
                    <span>
                      {group.label} <small>{group.items.length}개</small>
                    </span>
                    <span>
                      활성 월 환산 배정액 <b>{won(group.total)}원</b>
                    </span>
                  </div>
                </th>
              </tr>
              {group.items.map((r) => (
                <tr
                  key={r.id}
                  className={!r.original.active ? "expense-paused" : undefined}
                >
                  {r.getAllCells().map((c) => (
                    <td key={c.id}>
                      {flexRender(c.column.columnDef.cell, c.getContext())}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          ))}
        </table>
      </div>
      <div className="mobile-list">
        {groups.map((group) => (
          <section className="mobile-expense-group" key={group.label}>
            <h3>
              {group.label}{" "}
              <small>
                {group.items.length}개 · 활성 월 환산 배정액 {won(group.total)}
                원
              </small>
            </h3>
            {group.items.map(({ original: e }) => (
              <div className="mobile-expense-entry" key={e.id}>
                <button
                  className="mobile-expense"
                  onClick={() => !readOnly && onEdit(e)}
                >
                  <div>
                    <b>{e.name}</b>
                    <span
                      className="tag expense-category"
                      data-category={e.category}
                    >
                      {cashflowLabel(e.category)}
                    </span>
                    <small>
                      {e.cycle} 납부 · {e.active ? "활성" : "중지"}
                    </small>
                  </div>
                  <strong>
                    {won(monthlyEquivalent(e.amount, e.cycle))}원
                    <small>월 환산</small>
                  </strong>
                </button>
                <button
                  className="mobile-item-history"
                  aria-label={`${e.name} 지출 수정 이력·추이`}
                  onClick={() => onHistory(e)}
                >
                  <ChartNoAxesCombined size={14} />
                  수정 이력·추이
                </button>
              </div>
            ))}
          </section>
        ))}
      </div>
      {!data.length && (
        <div className="empty">일치하는 지출 항목이 없습니다.</div>
      )}
      <footer className="table-footer">
        총 {data.length}개 항목{" "}
        <span>용도는 이름 기반 자동 분류 · 수정 화면에서 변경 가능</span>
      </footer>
    </section>
  );
}
