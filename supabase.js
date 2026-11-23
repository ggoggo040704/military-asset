/**
 * Supabase 클라이언트 설정 및 데이터베이스 연동 함수 모듈
 */

const RAW_URL = "https://slrlokhpcrcntwdwqhcj.supabase.co/rest/v1/";
// Base URL 정제 (/rest/v1/ 제거하여 정규 URL 도메인 추출)
const SUPABASE_URL = RAW_URL.replace(/\/rest\/v1\/?$/, "");
const SUPABASE_ANON_KEY = "sb_publishable_pV8EX8c0iidNx6RgdBzBUg_IC2Ctgc2";

let supabaseClient = null;

// Supabase 클라이언트 초기화 함수
function initSupabase() {
  const statusIndicator = document.getElementById("status-indicator");
  const statusText = document.getElementById("status-text");

  if (SUPABASE_URL && SUPABASE_ANON_KEY && SUPABASE_URL.trim() !== "" && SUPABASE_ANON_KEY.trim() !== "") {
    try {
      if (window.supabase && typeof window.supabase.createClient === "function") {
        supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
        if (statusIndicator && statusText) {
          statusIndicator.className = "w-2.5 h-2.5 rounded-full bg-emerald-400 mr-2";
          statusText.innerText = "Supabase 실시간 클라우드 연결됨 🟢";
        }
        console.log("✅ Supabase 클라우드 연결 성공:", SUPABASE_URL);
        return true;
      } else {
        console.warn("Supabase SDK CDN 로드 대기 중...");
        return false;
      }
    } catch (err) {
      console.error("Supabase 연결 오류:", err);
      if (statusIndicator && statusText) {
        statusIndicator.className = "w-2.5 h-2.5 rounded-full bg-rose-500 mr-2";
        statusText.innerText = "Supabase 연결 오류 🔴";
      }
      return false;
    }
  } else {
    if (statusIndicator && statusText) {
      statusIndicator.className = "w-2.5 h-2.5 rounded-full bg-amber-400 mr-2 animate-pulse";
      statusText.innerText = "Supabase 키 미설정 🟡";
    }
    return false;
  }
}

// ==========================================
// 가계부 (military_expenses) CRUD API
// ==========================================

// 1. 전체 가계부 목록 불러오기
async function dbGetExpenses() {
  if (!supabaseClient) return [];
  try {
    const { data, error } = await supabaseClient
      .from("military_expenses")
      .select("*")
      .order("expense_date", { ascending: false });

    if (error) {
      console.error("가계부 조회 오류:", error.message);
      return null;
    }
    return data || [];
  } catch (err) {
    console.error("가계부 통신 예외:", err);
    return null;
  }
}

// 2. 가계부 항목 추가하기
async function dbAddExpense(expenseData) {
  if (!supabaseClient) throw new Error("Supabase가 연결되지 않았습니다.");
  const { data, error } = await supabaseClient
    .from("military_expenses")
    .insert([expenseData])
    .select();

  if (error) {
    console.error("가계부 등록 오류:", error.message);
    throw error;
  }
  return data;
}

// 3. 가계부 항목 삭제하기
async function dbDeleteExpense(id) {
  if (!supabaseClient) throw new Error("Supabase가 연결되지 않았습니다.");
  const { error } = await supabaseClient
    .from("military_expenses")
    .delete()
    .eq("id", id);

  if (error) {
    console.error("가계부 삭제 오류:", error.message);
    throw error;
  }
  return true;
}

// ==========================================
// 목표 자금 배분 (post_discharge_goals) CRUD API
// ==========================================

// 1. 목표 자금 목록 불러오기
async function dbGetGoals() {
  if (!supabaseClient) return [];
  try {
    const { data, error } = await supabaseClient
      .from("post_discharge_goals")
      .select("*")
      .order("id", { ascending: true });

    if (error) {
      console.error("목표 조회 오류:", error.message);
      return null;
    }
    return data || [];
  } catch (err) {
    console.error("목표 통신 예외:", err);
    return null;
  }
}

// 2. 목표 자금 목록 저장/동기화하기
async function dbSaveGoals(goalsList) {
  if (!supabaseClient) throw new Error("Supabase가 연결되지 않았습니다.");
  
  // 기존 목표 삭제 후 일괄 삽입
  await supabaseClient.from("post_discharge_goals").delete().neq("id", 0);
  const { data, error } = await supabaseClient
    .from("post_discharge_goals")
    .insert(goalsList)
    .select();

  if (error) {
    console.error("목표 저장 오류:", error.message);
    throw error;
  }
  return data;
}

// DOM 로딩 완료 시 자동 초기화
window.addEventListener("DOMContentLoaded", () => {
  initSupabase();
});
