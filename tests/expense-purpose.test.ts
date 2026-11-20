import { test } from "node:test";
import assert from "node:assert/strict";
import { expensePurpose } from "../lib/expense-purpose";
test("synthetic recurring expense names receive purpose without altering cash flow", () => {
  const cases = {
    "IRP 예시계좌": "연금",
    "출자금(예시기관)": "투자",
    우리사주: "투자",
    주택청약: "저축·청약",
    "적금(예시은행)": "저축·청약",
    "암보험(예시보험)": "보험",
    "자동차 보험(예시보험)": "보험",
    월세: "주거·공과금",
    "자동차 재산세": "세금",
    핸드폰비: "통신",
    "가족 핸드폰비": "가족 지원",
    "시골집(인터넷)": "가족 지원",
    유류비: "차량·교통",
    "운동(헬스장) 1년권": "건강·운동",
    동기회비: "모임·회비",
    "모호한 올원패스": "검토 필요",
    넷플릭스: "구독·멤버십",
    iCloud: "클라우드·AI",
    chatgpt: "클라우드·AI",
  };
  for (const [name, purpose] of Object.entries(cases))
    assert.equal(expensePurpose({ name, category: "소비지출" }), purpose, name);
  assert.equal(
    expensePurpose({ name: "쿠팡", category: "소비지출", purpose: "생활비" }),
    "생활비",
  );
  assert.equal(
    expensePurpose({ name: "새 항목", category: "소비지출" }),
    "미분류",
  );
});

test("ambiguous names remain reviewable and custom purposes survive", () => {
 assert.equal(expensePurpose({name:"쿠팡",category:"소비지출"}),"검토 필요");
 assert.equal(expensePurpose({name:"자동이체",category:"저축·투자"}),"검토 필요");
 assert.equal(expensePurpose({name:"VISA 카드",category:"소비지출"}),"미분류");
 assert.equal(expensePurpose({name:"전기차 주차비",category:"소비지출"}),"차량·교통");
 assert.equal(expensePurpose({name:"개인 항목",category:"소비지출",purpose:"나만의 용도"}),"나만의 용도");
});
