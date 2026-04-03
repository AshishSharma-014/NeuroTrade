// TAX CALCULATOR
function calculateTax() {
  const income = document.getElementById("income").value;

  if (!income) return;

  let tax = 0;

  if (income <= 250000) tax = 0;
  else if (income <= 500000) tax = income * 0.05;
  else if (income <= 1000000) tax = income * 0.2;
  else tax = income * 0.3;

  document.getElementById("taxResult").innerText =
    "Estimated Tax: ₹" + tax.toFixed(2);
}

// SAVINGS
function calculateSavings() {
  const salary = document.getElementById("salary").value;
  const expenses = document.getElementById("expenses").value;

  if (!salary || !expenses) return;

  const savings = salary - expenses;
  const percent = (savings / salary) * 100;

  document.getElementById("savingsResult").innerText =
    `You save ₹${savings} (${percent.toFixed(1)}%)`;

}

// GOAL
function calculateGoal() {
  const amount = document.getElementById("goalAmount").value;
  const years = document.getElementById("years").value;

  if (!amount || !years) return;

  const monthly = amount / (years * 12);

  document.getElementById("goalResult").innerText =
    `Invest ₹${monthly.toFixed(0)} per month to reach your goal`;
}