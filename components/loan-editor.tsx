"use client";
import { MoneyInput } from "./ui/money-input";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loan, loanSchema } from "@/lib/domain";
import { Button } from "./ui/button";
export function LoanEditor({
  loan,
  onSave,
  onDelete,
}: {
  loan?: Loan;
  onDelete?: () => void;
  onSave: (loan: Loan) => Promise<void>;
}) {
  const {
    register,
    control,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<Loan>({
    resolver: zodResolver(loanSchema),
    defaultValues: loan ?? {
      id: crypto.randomUUID(),
      name: "",
      principal: 0,
      rate: 4,
      months: 360,
      method: "원리금균등",
      monthlyPrincipal: 0,
      maturity: null,
      rateDate: null,
      verified: false,
      active: true,
    },
  });
  const nullDate = { setValueAs: (v: string) => (v === "" ? null : v) };
  return (
    <form className="form" onSubmit={handleSubmit(onSave)}>
      <label>
        대출명
        <input {...register("name")} />
      </label>
      <div className="form-row">
        <label>
          잔여 원금 (원)
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
                    e.target.value === "" ? NaN : Number(e.target.value),
                  )
                }
              />
            )}
          />
        </label>
        <label>
          연 금리 (%)
          <input
            type="number"
            step="0.01"
            {...register("rate", { valueAsNumber: true })}
          />
        </label>
      </div>
      <div className="form-row">
        <label>
          상환 방식
          <select {...register("method")}>
            {["원리금균등", "원금균등", "만기일시"].map((x) => (
              <option key={x}>{x}</option>
            ))}
          </select>
        </label>
        <label>
          남은 개월 수
          <input
            type="number"
            {...register("months", {
              setValueAs: (v) => (v === "" ? null : Number(v)),
            })}
          />
        </label>
      </div>
      {watch("method") === "원금균등" && (
        <label>
          약정 월 원금 (원 · 0이면 기간으로 계산)
          <Controller
            name="monthlyPrincipal"
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
      )}
      <div className="form-row">
        <label>
          만기 (선택)
          <input type="date" {...register("maturity", nullDate)} />
        </label>
        <label>
          금리 변경일 (선택)
          <input type="date" {...register("rateDate", nullDate)} />
        </label>
      </div>
      <label className="checkbox-label">
        <input type="checkbox" {...register("verified")} />
        계약과 잔액을 확인했습니다
      </label>
      <label className="checkbox-label">
        <input type="checkbox" {...register("active")} />
        상환 중 (해제하면 상환 완료)
      </label>
      {Object.keys(errors).length > 0 && (
        <p className="error">대출명·원금·금리·기간을 확인해 주세요.</p>
      )}
      {onDelete && (
        <Button
          variant="outline"
          className="danger"
          type="button"
          disabled={isSubmitting}
          onClick={onDelete}
        >
          대출 삭제
        </Button>
      )}
      <Button disabled={isSubmitting} type="submit">
        대출 저장
      </Button>
    </form>
  );
}
