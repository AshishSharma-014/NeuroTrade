'use strict';

const INR = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 0,
});

function byId(id) {
  return document.getElementById(id);
}

function formatInr(value) {
  const amount = Number(value) || 0;
  return INR.format(amount);
}

function setText(id, text) {
  const el = byId(id);
  if (el) el.textContent = text;
}

function addMessage(role, text) {
  const chatWindow = byId('chatWindow');
  if (!chatWindow) return;

  const wrapper = document.createElement('div');
  wrapper.className = `message ${role}`;

  const roleEl = document.createElement('div');
  roleEl.className = 'message-role';
  roleEl.textContent = role === 'user' ? 'You' : 'Virtual CA';

  const textEl = document.createElement('p');
  textEl.textContent = text;

  wrapper.append(roleEl, textEl);
  chatWindow.appendChild(wrapper);
  chatWindow.scrollTop = chatWindow.scrollHeight;
}

function setAssistantState(label, mode) {
  setText('assistantLiveLabel', label);
  if (mode) setText('assistantMode', mode);
}

function calculateTax() {
  const income = Number(byId('income')?.value || 0);
  const output = byId('taxResult');
  if (!output) return;

  if (income <= 0) {
    output.textContent = 'Enter a valid annual income to estimate tax.';
    return;
  }

  let tax = 0;
  if (income <= 250000) tax = 0;
  else if (income <= 500000) tax = (income - 250000) * 0.05;
  else if (income <= 1000000) tax = 12500 + (income - 500000) * 0.2;
  else tax = 112500 + (income - 1000000) * 0.3;

  const monthlyProvision = tax / 12;
  output.textContent = `Estimated tax: ${formatInr(tax)}. Set aside about ${formatInr(monthlyProvision)} per month for smoother cash flow.`;
}

function calculateSavings() {
  const salary = Number(byId('salary')?.value || 0);
  const expenses = Number(byId('expenses')?.value || 0);
  const output = byId('savingsResult');
  if (!output) return;

  if (salary <= 0 || expenses < 0) {
    output.textContent = 'Enter valid monthly salary and expense values.';
    return;
  }

  const savings = salary - expenses;
  const savingsRate = salary > 0 ? (savings / salary) * 100 : 0;
  const status =
    savings < 0
      ? 'You are overspending right now. Reduce expenses or increase income before starting new investments.'
      : savingsRate >= 30
        ? 'Strong savings rate. You can split this between emergency fund, SIPs, and short-term goals.'
        : savingsRate >= 15
          ? 'Healthy start. Try nudging savings closer to 20% by trimming non-essential spending.'
          : 'Low savings rate. Review subscriptions, dining, and impulse spending first.';

  output.textContent = `Monthly savings: ${formatInr(savings)} (${savingsRate.toFixed(1)}%). ${status}`;
  setText('heroMonthlySavings', formatInr(savings));
}

function calculateGoal() {
  const amount = Number(byId('goalAmount')?.value || 0);
  const years = Number(byId('years')?.value || 0);
  const output = byId('goalResult');
  if (!output) return;

  if (amount <= 0 || years <= 0) {
    output.textContent = 'Enter a valid target amount and time horizon.';
    return;
  }

  const months = years * 12;
  const monthly = amount / months;
  const weekly = monthly / 4.33;
  output.textContent = `To reach ${formatInr(amount)} in ${years} year(s), invest about ${formatInr(monthly)} per month or ${formatInr(weekly)} per week.`;
  setText('heroGoalMonthly', formatInr(monthly));
}

async function askVirtualCA() {
  const input = byId('caQuestion');
  const button = byId('askCAButton');
  if (!input || !button) return;

  const question = input.value.trim();
  if (!question) return;

  addMessage('user', question);
  input.value = '';
  button.disabled = true;
  setAssistantState('Thinking...', 'Gemini request in progress');

  try {
    const res = await fetch('/api/ai-advice', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: question }),
    });

    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.message || 'Could not get a response.');
    }

    addMessage('bot', data.reply);
    setText('aiStatusBadge', data.provider === 'gemini' ? 'Gemini live' : 'Fallback guidance');
    setAssistantState('Responded', data.provider === 'gemini' ? 'Gemini financial guidance' : 'Rule-based financial guidance');
  } catch (error) {
    addMessage('bot', 'I could not reach the assistant right now. Check the backend and Gemini API key, then try again.');
    setAssistantState('Error', 'Connection issue');
  } finally {
    button.disabled = false;
  }
}

function attachPromptChips() {
  document.querySelectorAll('[data-prompt]').forEach((chip) => {
    chip.addEventListener('click', () => {
      const input = byId('caQuestion');
      if (!input) return;
      input.value = chip.getAttribute('data-prompt') || '';
      input.focus();
    });
  });
}

function attachScrollButtons() {
  document.querySelectorAll('[data-scroll-target]').forEach((button) => {
    button.addEventListener('click', () => {
      const selector = button.getAttribute('data-scroll-target');
      const target = selector ? document.querySelector(selector) : null;
      if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  });
}

function attachAssistant() {
  const button = byId('askCAButton');
  const input = byId('caQuestion');

  if (button) button.addEventListener('click', askVirtualCA);
  if (input) {
    input.addEventListener('keydown', (event) => {
      if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
        askVirtualCA();
      }
    });
  }
}

function exposeCalculators() {
  window.calculateTax = calculateTax;
  window.calculateSavings = calculateSavings;
  window.calculateGoal = calculateGoal;
}

function bootVirtualCA() {
  exposeCalculators();
  attachAssistant();
  attachPromptChips();
  attachScrollButtons();
  calculateSavings();
  calculateGoal();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bootVirtualCA);
} else {
  bootVirtualCA();
}
