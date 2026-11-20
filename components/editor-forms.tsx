"use client";
import { cashflowLabel } from "@/lib/classification";
import { MoneyInput } from "./ui/money-input";
import { EXPENSE_PURPOSES, expensePurpose } from "@/lib/expense-purpose";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Asset,
  Expense,
  assetSchema,
  expenseSchema,
  won,
  monthlyEquivalent,
} from "@/lib/domain";
import { Modal } from "./ui/modal";
import { Button } from "./ui/button";
export function AssetForm({
  asset,
  categories = ["현금", "투자", "연금", "부동산", "기타"],
  onSave,
  onClose,
  onDelete,
}: {
  asset?: Asset;
  categories?: string[];
  onSave: (a: Asset) => Promise<void>;
  onClose: () => void;
  onDelete?: () => void;
}) {
  const {
    register,
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<Asset>({
    resolver: zodResolver(assetSchema),
    defaultValues: asset ?? {
      id: crypto.randomUUID(),
      name: "",
      category: "현금",
      institution: "",
      value: 0,
      principal: null,
      date: new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Seoul" }),
      active: true,
    },
  });
  return (
    <Modal title={asset ? "자산 수정" : "새 자산 추가"} onClose={onClose}>
      <form className="form" onSubmit={handleSubmit(onSave)}>
        <label>
          자산명
          <input {...register("name")} autoComplete="off" />
        </label>
        <div className="form-row">
          <label>
            유형
            <select {...register("category")}>
              {categories.map((x) => (
                <option key={x} value={x}>
                  {cashflowLabel(x)}
                </option>
              ))}
            </select>
          </label>
          <label>
            금융기관
            <input {...register("institution")} />
          </label>
        </div>
        <div className="form-row">
          <label>
            평가액 (원)
            <Controller
              name="value"
              control={control}
              render={({ field }) => (
                <MoneyInput
                  name={field.name}
                  ref={field.ref}
                  value={field.value}
                  onBlur={field.onBlur}
                  onChange={(e) =>
                    field.onChange(
                      e.target.value === "" ? NaN : Number(e.target.value),
                    )
                  }
                />
              )}
            />
          </label>
          <label>
            투자원금 (선택)
            <Controller
              name="principal"
              control={control}
              render={({ field }) => (
                <MoneyInput
                  name={field.name}
                  ref={field.ref}
                  value={field.value}
                  onBlur={field.onBlur}
                  onChange={(e) =>
                    field.onChange(
                      e.target.value === "" ? null : Number(e.target.value),
                    )
                  }
                />
              )}
            />
          </label>
        </div>
        <label>
          평가 기준일
          <input type="date" {...register("date")} />
        </label>
        <label className="checkbox-label">
          <input type="checkbox" {...register("active")} />
          활성 자산
        </label>
        {Object.keys(errors).length > 0 && (
          <p className="error">
            자산명, 유효한 날짜와 0 이상의 정수 금액을 확인하세요.
          </p>
        )}
        {onDelete && (
          <Button
            variant="outline"
            className="danger"
            type="button"
            disabled={isSubmitting}
            onClick={onDelete}
          >
            항목 삭제
          </Button>
        )}
        <Button type="submit" disabled={isSubmitting}>
          자산 저장
        </Button>
      </form>
    </Modal>
  );
}
export function ExpenseForm({
  expense,
  onSave,
  onClose,
  onDelete,
}: {
  expense?: Expense;
  onSave: (e: Expense) => Promise<void>;
  onClose: () => void;
  onDelete?: () => void;
}) {
  const {
    register,
    control,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<Expense>({
    resolver: zodResolver(expenseSchema),
    defaultValues: expense ?? {
      id: crypto.randomUUID(),
      name: "",
      category: "소비지출",
      amount: 0,
      cycle: "월",
      day: 1,
      account: "",
      active: true,
    },
  });
  return (
    <Modal
      title={expense ? "고정지출 수정" : "고정지출 추가"}
      onClose={onClose}
    >
      <form className="form" onSubmit={handleSubmit(onSave)}>
        <label>
          지출 항목
          <input {...register("name")} />
        </label>
        <label>
          현금흐름 구분
          <select {...register("category")}>
            {[
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
        </label>
        <label>
          세부 용도
          <select
            aria-label="세부 용도"
            {...register("purpose", { setValueAs: (v) => v || undefined })}
          >
            <option value="">
              자동 분류 (
              {expensePurpose({
                name: watch("name"),
                category: watch("category"),
              })}
              )
            </option>
            {expense?.purpose &&
              !EXPENSE_PURPOSES.some((p) => p === expense.purpose) && (
                <option value={expense.purpose}>{expense.purpose}</option>
              )}
            {EXPENSE_PURPOSES.map((purpose) => (
              <option key={purpose}>{purpose}</option>
            ))}
          </select>
        </label>
        <div className="form-row">
          <label>
            회당 납부액 (원)
            <Controller
              name="amount"
              control={control}
              render={({ field }) => (
                <MoneyInput
                  name={field.name}
                  ref={field.ref}
                  value={field.value}
                  onBlur={field.onBlur}
                  onChange={(e) =>
                    field.onChange(
                      e.target.value === "" ? NaN : Number(e.target.value),
                    )
                  }
                />
              )}
            />
          </label>
          <label>
            납부주기
            <select {...register("cycle")}>
              {["월", "분기", "6개월", "연"].map((x) => (
                <option key={x} value={x}>
                  {cashflowLabel(x)}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="form-row">
          <label>
            납부일
            <input
              type="number"
              {...register("day", { valueAsNumber: true })}
            />
          </label>
          <label>
            출금계좌
            <input {...register("account")} />
          </label>
        </div>
        <div className="form-summary">
          월 환산 {won(monthlyEquivalent(watch("amount") || 0, watch("cycle")))}
          원{" "}
          <span>
            연간{" "}
            {won(monthlyEquivalent(watch("amount") || 0, watch("cycle")) * 12)}
            원
          </span>
        </div>
        {watch("cycle") !== "월" && (
          <label>
            다음 실제 납부일 (선택)
            <input
              type="date"
              {...register("dueDate", {
                setValueAs: (v) => (v === "" ? undefined : v),
              })}
            />
          </label>
        )}
        <label>
          보험·계약 만기 (선택)
          <input
            type="date"
            {...register("maturityDate", {
              setValueAs: (v) => (v === "" ? undefined : v),
            })}
          />
        </label>
        <label>
          메모
          <input {...register("note")} />
        </label>
        <label className="checkbox-label">
          <input type="checkbox" {...register("active")} />
          정기지출 활성
        </label>
        {Object.keys(errors).length > 0 && (
          <p className="error">
            항목명, 0 이상 정수 금액, 1~31일 납부일을 확인하세요.
          </p>
        )}
        {onDelete && (
          <Button
            variant="outline"
            className="danger"
            type="button"
            disabled={isSubmitting}
            onClick={onDelete}
          >
            항목 삭제
          </Button>
        )}
        <Button type="submit" disabled={isSubmitting}>
          지출 저장
        </Button>
      </form>
    </Modal>
  );
}
