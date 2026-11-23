/**
 * 군 복무 목돈 모으기 & 전역 후 자금 설계 시뮬레이터
 * 메인 애플리케이션 로직 (app.js)
 * Supabase 실시간 연동 (가계부 CRUD & 목표 배분 저장)
 */

let currentRole = "soldier"; // "soldier" 또는 "officer"
let savingsChartInstance = null;
let goalsChartInstance = null;
let currentGrandTotal = 14970000;

// 군별/신분별 복무 옵션 정의
const BRANCH_OPTIONS = {
  soldier: [
    { label: "육군 / 해병대 / 상근예비역 (18개월)", value: 18 },
    { label: "해군 (20개월)", value: 20 },
    { label: "공군 / 사회복무요원 (21개월)", value: 21 },
    { label: "직접 개월 수 입력", value: "custom" }
  ],
  officer: [
    { label: "학군장교 (ROTC, 28개월)", value: 28 },
    { label: "학사장교 / 단기사관 (36개월)", value: 36 },
    { label: "단기복무 부사관 (하사, 48개월)", value: 48 },
    { label: "임기제 부사관 / 전문하사 (12개월)", value: 12 },
    { label: "임기제 부사관 / 전문하사 (24개월)", value: 24 },
    { label: "직접 개월 수 입력", value: "custom" }
  ]
};

// 기본 목표 자금 리스트
let goalsList = [
  { id: 1, title: "전역 기념 유럽/동남아 여행", category_icon: "✈️", allocated_amount: 3000000, color: "#10b981" },
  { id: 2, title: "전역/복학 자취방 보증금", category_icon: "🏠", allocated_amount: 7000000, color: "#14b8a6" },
  { id: 3, title: "사회 진출용 맥북/노트북 구매", category_icon: "💻", allocated_amount: 2000000, color: "#06b6d4" },
  { id: 4, title: "사회초년생 시드머니 / 비상금", category_icon: "📈", allocated_amount: 2970000, color: "#6366f1" }
];

// 로컬 가계부 캐시 (Supabase 미연결 또는 로딩 대기 시 사용)
let expensesList = [
  { id: 1, expense_date: "2026-11-15", category: "PX", description: "닥터지 레드 블레미쉬 수분크림 & 슈넬치킨", amount: 18500 },
  { id: 2, expense_date: "2026-11-10", category: "외출/외박", description: "전우들과 삼겹살 파티 & PC방", amount: 45000 }
];

// ==========================================
// 1. 탭 전환 제어
// ==========================================
function switchTab(tabId) {
  document.querySelectorAll(".tab-content").forEach(el => {
    el.classList.add("hidden");
    el.classList.remove("block");
  });

  const target = document.getElementById(tabId);
  if (target) {
    target.classList.remove("hidden");
    target.classList.add("block");
  }

  document.querySelectorAll(".tab-btn").forEach(btn => {
    btn.classList.remove("active-tab");
    btn.classList.add("border-transparent", "text-slate-500");
  });

  const activeBtn = document.getElementById("btn-" + tabId);
  if (activeBtn) {
    activeBtn.classList.add("active-tab");
    activeBtn.classList.remove("border-transparent", "text-slate-500");
  }

  if (tabId === "tab-simulator" && savingsChartInstance) {
    savingsChartInstance.resize();
  } else if (tabId === "tab-ledger") {
    loadExpenses();
  } else if (tabId === "tab-goals") {
    renderGoalsUI();
  }
}

// ==========================================
// 2. 신분 전환 (병사 vs 간부)
// ==========================================
function setUserRole(role) {
  currentRole = role;

  const soldierBtn = document.getElementById("role-soldier-btn");
  const officerBtn = document.getElementById("role-officer-btn");
  const branchSelect = document.getElementById("branch-select");
  const monthlyRange = document.getElementById("monthly-amount-range");
  const monthlyGuide = document.getElementById("monthly-guide-text");
  const interestGuide = document.getElementById("interest-guide");
  const officerBonusSection = document.getElementById("officer-bonus-section");
  const formSubtitle = document.getElementById("form-subtitle");
  const badgeTitle = document.getElementById("badge-role-title");
  const badgeDesc = document.getElementById("badge-role-desc");
  const labelSupport = document.getElementById("label-support");
  const enlistLabel = document.getElementById("enlist-label");

  if (role === "soldier") {
    soldierBtn.className = "py-2 rounded-lg bg-white text-emerald-800 shadow-sm transition";
    officerBtn.className = "py-2 rounded-lg text-slate-500 hover:text-slate-800 transition";

    formSubtitle.innerText = "병사(장병내일준비적금 정부 100% 매칭지원금 적용)";
    badgeTitle.innerText = "병사 전역 시 최종 목돈";
    badgeDesc.innerText = "(원금 + 우대이자 + 정부 100% 매칭금)";
    labelSupport.innerText = "정부 100% 매칭금";
    enlistLabel.innerText = "입대일";

    monthlyRange.min = 100000;
    monthlyRange.max = 400000;
    monthlyRange.step = 50000;
    monthlyRange.value = 400000;
    monthlyGuide.innerHTML = "<span>10만원</span><span>20만원(1개 은행)</span><span>40만원(최대)</span>";
    interestGuide.innerText = "※ 병사: 장병내일준비적금 평균 우대금리 약 5.0% (비과세)";

    officerBonusSection.classList.add("hidden");
  } else {
    officerBtn.className = "py-2 rounded-lg bg-white text-emerald-800 shadow-sm transition";
    soldierBtn.className = "py-2 rounded-lg text-slate-500 hover:text-slate-800 transition";

    formSubtitle.innerText = "초급간부(군인공제회/우대적금 저축 + 단기복무 장려금/퇴직금)";
    badgeTitle.innerText = "간부 전역 시 최종 목돈";
    badgeDesc.innerText = "(급여 저축원금 + 이자수익 + 단기복무 장려금)";
    labelSupport.innerText = "단기복무 장려금/수당";
    enlistLabel.innerText = "임관(입대)일";

    monthlyRange.min = 100000;
    monthlyRange.max = 2000000;
    monthlyRange.step = 100000;
    monthlyRange.value = 1000000;
    monthlyGuide.innerHTML = "<span>10만원</span><span>100만원(추천)</span><span>200만원(최대)</span>";
    interestGuide.innerText = "※ 간부: 군인공제회/청년도약계좌/군우대적금 평균 금리 약 4.5%~5.5%";

    officerBonusSection.classList.remove("hidden");
  }

  branchSelect.innerHTML = "";
  BRANCH_OPTIONS[role].forEach(opt => {
    const el = document.createElement("option");
    el.value = opt.value;
    el.innerText = opt.label;
    branchSelect.appendChild(el);
  });

  updateMonthlyAmount(monthlyRange.value);
  handleBranchChange();
}

function updateMonthlyAmount(val) {
  const num = parseInt(val, 10);
  document.getElementById("monthly-amount-text").innerText = num.toLocaleString("ko-KR") + "원";
  calculateSavings();
}

function updateOfficerBonus(val) {
  const num = parseInt(val, 10) || 0;
  document.getElementById("officer-bonus-text").innerText = num.toLocaleString("ko-KR") + "원";
  calculateSavings();
}

function handleBranchChange() {
  const branchSelect = document.getElementById("branch-select");
  const enlistInput = document.getElementById("enlist-date");
  const dischargeInput = document.getElementById("discharge-date");

  if (branchSelect.value === "custom") {
    calculateSavings();
    return;
  }

  const months = parseInt(branchSelect.value, 10);
  if (enlistInput.value) {
    const enlistDate = new Date(enlistInput.value);
    const dischargeDate = new Date(enlistDate);
    dischargeDate.setMonth(dischargeDate.getMonth() + months);
    dischargeDate.setDate(dischargeDate.getDate() - 1);
    dischargeInput.value = dischargeDate.toISOString().split("T")[0];
  }
  calculateSavings();
}

// ==========================================
// 3. 목돈 계산 메인 함수
// ==========================================
function calculateSavings() {
  const branchSelect = document.getElementById("branch-select");
  const monthlyAmount = parseInt(document.getElementById("monthly-amount-range").value, 10);
  const annualRate = parseFloat(document.getElementById("interest-rate").value) / 100;

  let totalMonths = currentRole === "soldier" ? 18 : 28;
  const enlistDateVal = document.getElementById("enlist-date").value;
  const dischargeDateVal = document.getElementById("discharge-date").value;

  if (enlistDateVal && dischargeDateVal) {
    const start = new Date(enlistDateVal);
    const end = new Date(dischargeDateVal);
    const diffMonths = (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth());
    totalMonths = diffMonths > 0 ? diffMonths : parseInt(branchSelect.value, 10) || totalMonths;
  } else if (branchSelect.value !== "custom") {
    totalMonths = parseInt(branchSelect.value, 10);
  }

  const totalPrincipal = monthlyAmount * totalMonths;
  const monthlyRate = annualRate / 12;
  const totalInterest = Math.round(monthlyAmount * monthlyRate * (totalMonths * (totalMonths + 1) / 2));

  let thirdAmount = 0;
  if (currentRole === "soldier") {
    thirdAmount = totalPrincipal + totalInterest;
  } else {
    const bonusInput = document.getElementById("officer-bonus-input");
    thirdAmount = bonusInput ? (parseInt(bonusInput.value, 10) || 0) : 0;
  }

  currentGrandTotal = totalPrincipal + totalInterest + thirdAmount;

  document.getElementById("result-principal").innerText = totalPrincipal.toLocaleString("ko-KR") + "원";
  document.getElementById("result-interest").innerText = totalInterest.toLocaleString("ko-KR") + "원";
  document.getElementById("result-match").innerText = thirdAmount.toLocaleString("ko-KR") + "원";
  document.getElementById("result-total").innerText = currentGrandTotal.toLocaleString("ko-KR");

  // 목표 탭의 총액 갱신
  syncGoalTotalFund(currentGrandTotal);

  renderSavingsChart(totalMonths, monthlyAmount, monthlyRate, thirdAmount);
}

// 차트 렌더링
function renderSavingsChart(months, monthlyAmount, monthlyRate, thirdTotalAmount) {
  const ctx = document.getElementById("savingsChart").getContext("2d");
  const labels = [];
  const principalData = [];
  const interestData = [];
  const thirdData = [];

  const thirdLabel = currentRole === "soldier" ? "정부 100% 매칭지원금" : "단기복무 장려금/수당";
  const thirdColor = currentRole === "soldier" ? "#06b6d4" : "#6366f1";

  for (let m = 1; m <= months; m++) {
    labels.push(m + "개월");
    const p = monthlyAmount * m;
    const i = Math.round(monthlyAmount * monthlyRate * (m * (m + 1) / 2));
    const t = currentRole === "soldier" ? (p + i) : Math.round((thirdTotalAmount / months) * m);

    principalData.push(p);
    interestData.push(i);
    thirdData.push(t);
  }

  if (savingsChartInstance) {
    savingsChartInstance.destroy();
  }

  savingsChartInstance = new Chart(ctx, {
    type: "bar",
    data: {
      labels: labels,
      datasets: [
        {
          label: "납입 원금",
          data: principalData,
          backgroundColor: "#10b981",
          stack: "combined",
        },
        {
          label: "이자 수익",
          data: interestData,
          backgroundColor: "#f59e0b",
          stack: "combined",
        },
        {
          label: thirdLabel,
          data: thirdData,
          backgroundColor: thirdColor,
          stack: "combined",
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: "top",
          labels: { boxWidth: 12, font: { size: 11, family: "Pretendard" } }
        },
        tooltip: {
          callbacks: {
            label: function(context) {
              return context.dataset.label + ": " + Number(context.raw).toLocaleString("ko-KR") + "원";
            }
          }
        }
      },
      scales: {
        x: { grid: { display: false }, ticks: { font: { size: 10 } } },
        y: {
          stacked: true,
          ticks: {
            callback: function(val) { return (val / 10000).toLocaleString() + "만원"; },
            font: { size: 10 }
          }
        }
      }
    }
  });
}

// ==========================================
// 4. 군 생활 가계부 (Supabase CRUD)
// ==========================================

// 가계부 모달 열기/닫기
function openExpenseModal() {
  const modal = document.getElementById("expense-modal");
  const dateInput = document.getElementById("modal-expense-date");
  if (dateInput && !dateInput.value) {
    dateInput.value = new Date().toISOString().split("T")[0];
  }
  modal.classList.remove("hidden");
}

function closeExpenseModal() {
  document.getElementById("expense-modal").classList.add("hidden");
  document.getElementById("expense-form").reset();
}

// 지출 내역 DB 등록 처리
async function handleCreateExpense(event) {
  event.preventDefault();
  const date = document.getElementById("modal-expense-date").value;
  const category = document.getElementById("modal-expense-category").value;
  const description = document.getElementById("modal-expense-desc").value.trim();
  const amount = parseInt(document.getElementById("modal-expense-amount").value, 10);

  if (!description || !amount || amount <= 0) {
    alert("내용과 올바른 금액을 입력해 주세요.");
    return;
  }

  const newExpense = {
    expense_date: date,
    category: category,
    description: description,
    amount: amount
  };

  const submitBtn = document.getElementById("modal-submit-btn");
  const originalText = submitBtn.innerHTML;
  submitBtn.disabled = true;
  submitBtn.innerHTML = "<i class='fa-solid fa-spinner fa-spin'></i> 저장 중...";

  try {
    if (typeof dbAddExpense === "function") {
      await dbAddExpense(newExpense);
    } else {
      // 로컬 임시 추가
      newExpense.id = Date.now();
      expensesList.unshift(newExpense);
    }
    closeExpenseModal();
    await loadExpenses();
  } catch (err) {
    alert("Supabase 저장 중 오류가 발생했습니다: " + err.message);
  } finally {
    submitBtn.disabled = false;
    submitBtn.innerHTML = originalText;
  }
}

// 가계부 내역 삭제 처리
async function handleDeleteExpense(id) {
  if (!confirm("이 지출 내역을 정말 삭제하시겠습니까?")) return;

  try {
    if (typeof dbDeleteExpense === "function") {
      await dbDeleteExpense(id);
    } else {
      expensesList = expensesList.filter(item => item.id !== id);
    }
    await loadExpenses();
  } catch (err) {
    alert("삭제 실패: " + err.message);
  }
}

// 가계부 목록 불러오기 & 화면 렌더링
async function loadExpenses() {
  const tbody = document.getElementById("expense-list");
  if (!tbody) return;

  let items = [];
  try {
    if (typeof dbGetExpenses === "function") {
      const data = await dbGetExpenses();
      if (data && data.length > 0) {
        items = data;
        expensesList = data;
      } else {
        items = expensesList;
      }
    } else {
      items = expensesList;
    }
  } catch (err) {
    console.warn("DB 가계부 로드 실패, 캐시 사용:", err);
    items = expensesList;
  }

  // 통계 계산
  let totalAmount = 0;
  const categoryCounts = {};

  if (!items || items.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" class="py-8 text-center text-slate-400">등록된 지출 내역이 없습니다. 오른쪽 위 '지출 내역 등록'을 눌러 첫 지출을 기록해보세요!</td></tr>`;
  } else {
    tbody.innerHTML = items.map(item => {
      totalAmount += Number(item.amount);
      categoryCounts[item.category] = (categoryCounts[item.category] || 0) + Number(item.amount);

      let badgeBg = "bg-emerald-100 text-emerald-800";
      if (item.category === "외출/외박") badgeBg = "bg-blue-100 text-blue-800";
      if (item.category === "휴가") badgeBg = "bg-purple-100 text-purple-800";
      if (item.category === "배달/식비") badgeBg = "bg-amber-100 text-amber-800";
      if (item.category === "통신/기타") badgeBg = "bg-slate-200 text-slate-800";

      return `
        <tr class="hover:bg-slate-50 transition">
          <td class="py-2.5 px-3 text-slate-500 font-mono">${item.expense_date}</td>
          <td class="py-2.5 px-3"><span class="${badgeBg} px-2 py-0.5 rounded text-[11px] font-semibold">${item.category}</span></td>
          <td class="py-2.5 px-3 font-medium text-slate-800">${item.description}</td>
          <td class="py-2.5 px-3 text-right font-bold text-slate-900">${Number(item.amount).toLocaleString("ko-KR")}원</td>
          <td class="py-2.5 px-3 text-center">
            <button onclick="handleDeleteExpense(${item.id})" class="text-slate-400 hover:text-rose-500 transition p-1" title="삭제">
              <i class="fa-solid fa-trash-can"></i>
            </button>
          </td>
        </tr>
      `;
    }).join("");
  }

  // 상단 통계 카드 업데이트
  document.getElementById("ledger-total-amount").innerText = totalAmount.toLocaleString("ko-KR") + "원";
  document.getElementById("ledger-item-count").innerText = (items ? items.length : 0) + "건";

  // 최다 지출 카테고리
  let topCategory = "-";
  let maxSpend = 0;
  for (const cat in categoryCounts) {
    if (categoryCounts[cat] > maxSpend) {
      maxSpend = categoryCounts[cat];
      topCategory = cat;
    }
  }
  document.getElementById("ledger-top-category").innerText = topCategory;
}

// ==========================================
// 5. 전역 후 목표 자금 배분 (Supabase 연동)
// ==========================================

function syncGoalTotalFund(grandTotal) {
  const goalFundEl = document.getElementById("goal-total-fund");
  if (goalFundEl) {
    goalFundEl.innerText = grandTotal.toLocaleString("ko-KR") + "원";
  }
  renderGoalsUI();
}

function renderGoalsUI() {
  const container = document.getElementById("goal-items-container");
  if (!container) return;

  const totalFund = currentGrandTotal || 14970000;
  let allocatedSum = 0;

  container.innerHTML = goalsList.map((goal, idx) => {
    allocatedSum += Number(goal.allocated_amount);
    const percent = totalFund > 0 ? Math.round((goal.allocated_amount / totalFund) * 100) : 0;

    return `
      <div class="p-4 bg-white border border-slate-200 rounded-xl hover:border-emerald-300 transition space-y-2">
        <div class="flex justify-between items-center">
          <div class="flex items-center space-x-2">
            <span class="text-base">${goal.category_icon || "🎯"}</span>
            <span class="font-bold text-sm text-slate-800">${goal.title}</span>
          </div>
          <div class="text-right flex items-center space-x-2">
            <span class="text-xs font-extrabold text-emerald-700">${Number(goal.allocated_amount).toLocaleString("ko-KR")}원 (${percent}%)</span>
            <button onclick="handleDeleteGoal(${idx})" class="text-slate-300 hover:text-rose-500 text-xs p-1" title="목표 삭제">
              <i class="fa-solid fa-xmark"></i>
            </button>
          </div>
        </div>
        
        <!-- 슬라이더로 실시간 금액 조절 -->
        <input type="range" min="0" max="${totalFund}" step="100000" value="${goal.allocated_amount}" 
          class="w-full accent-emerald-600 cursor-pointer h-1.5 bg-slate-100 rounded-lg"
          oninput="handleGoalAmountChange(${idx}, this.value)">
      </div>
    `;
  }).join("");

  // 남은 미배분 자금
  const remainFund = totalFund - allocatedSum;
  const remainEl = document.getElementById("goal-remain-fund");
  if (remainEl) {
    if (remainFund >= 0) {
      remainEl.innerText = remainFund.toLocaleString("ko-KR") + "원 (여유)";
      remainEl.className = "text-base font-bold text-emerald-600";
    } else {
      remainEl.innerText = Math.abs(remainFund).toLocaleString("ko-KR") + "원 초과 ⚠️";
      remainEl.className = "text-base font-bold text-rose-600";
    }
  }

  // 도넛 차트 업데이트
  updateGoalsDonutChart();
}

function handleGoalAmountChange(index, newVal) {
  goalsList[index].allocated_amount = parseInt(newVal, 10) || 0;
  renderGoalsUI();
}

function handleDeleteGoal(index) {
  if (goalsList.length <= 1) {
    alert("최소 1개의 목표는 유지해야 합니다.");
    return;
  }
  goalsList.splice(index, 1);
  renderGoalsUI();
}

function openAddGoalModal() {
  document.getElementById("goal-modal").classList.remove("hidden");
}

function closeAddGoalModal() {
  document.getElementById("goal-modal").classList.add("hidden");
}

function handleCreateGoal(e) {
  e.preventDefault();
  const title = document.getElementById("modal-goal-title").value.trim();
  const icon = document.getElementById("modal-goal-icon").value.trim() || "🎯";
  const amount = parseInt(document.getElementById("modal-goal-amount").value, 10) || 1000000;

  if (!title) return;

  const colors = ["#10b981", "#14b8a6", "#06b6d4", "#6366f1", "#ec4899", "#f59e0b", "#8b5cf6"];
  const randomColor = colors[goalsList.length % colors.length];

  goalsList.push({
    id: Date.now(),
    title: title,
    category_icon: icon,
    allocated_amount: amount,
    color: randomColor
  });

  closeAddGoalModal();
  renderGoalsUI();
}

// 도넛 차트 업데이트
function updateGoalsDonutChart() {
  const ctx = document.getElementById("goalsChart");
  if (!ctx) return;

  const labels = goalsList.map(g => (g.category_icon ? g.category_icon + " " : "") + g.title);
  const data = goalsList.map(g => g.allocated_amount);
  const colors = goalsList.map((g, idx) => {
    const defaultColors = ["#10b981", "#14b8a6", "#06b6d4", "#6366f1", "#f59e0b", "#ec4899"];
    return g.color || defaultColors[idx % defaultColors.length];
  });

  if (goalsChartInstance) {
    goalsChartInstance.destroy();
  }

  goalsChartInstance = new Chart(ctx.getContext("2d"), {
    type: "doughnut",
    data: {
      labels: labels,
      datasets: [{
        data: data,
        backgroundColor: colors,
        borderWidth: 2,
        borderColor: "#ffffff"
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: "bottom",
          labels: { boxWidth: 10, font: { size: 10, family: "Pretendard" } }
        },
        tooltip: {
          callbacks: {
            label: function(ctx) {
              return ctx.label + ": " + Number(ctx.raw).toLocaleString("ko-KR") + "원";
            }
          }
        }
      },
      cutout: "60%"
    }
  });
}

// 목표 설정 Supabase 저장
async function saveCurrentGoalsToDb() {
  try {
    if (typeof dbSaveGoals === "function") {
      const payload = goalsList.map(g => ({
        title: g.title,
        allocated_amount: g.allocated_amount,
        category_icon: g.category_icon || "🎯",
        color: g.color || "#10b981"
      }));
      await dbSaveGoals(payload);
      alert("✅ Supabase 클라우드에 전역 후 목표 자금 설정이 안전하게 저장되었습니다!");
    } else {
      alert("✅ 로컬에 목표 자금 설정이 저장되었습니다.");
    }
  } catch (err) {
    alert("목표 저장 중 오류가 발생했습니다: " + err.message);
  }
}

// ==========================================
// 6. 초기 실행
// ==========================================
window.addEventListener("DOMContentLoaded", async () => {
  const today = new Date();
  const enlistInput = document.getElementById("enlist-date");
  if (enlistInput && !enlistInput.value) {
    enlistInput.value = today.toISOString().split("T")[0];
  }

  setUserRole("soldier");

  // Supabase 데이터베이스 초기 로드 시도
  setTimeout(async () => {
    try {
      if (typeof dbGetExpenses === "function") {
        await loadExpenses();
      }
      if (typeof dbGetGoals === "function") {
        const dbGoals = await dbGetGoals();
        if (dbGoals && dbGoals.length > 0) {
          goalsList = dbGoals;
        }
      }
      renderGoalsUI();
    } catch (e) {
      console.log("초기 DB 로드:", e);
    }
  }, 300);
});
