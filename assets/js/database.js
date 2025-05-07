// Усі ваші імпорти залишаються без змін
import {
  getFirestore,
  collection,
  getDocs,
  query,
  where,
  addDoc,
  doc,
  updateDoc,
  deleteDoc,
} from "https://www.gstatic.com/firebasejs/11.2.0/firebase-firestore.js";
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.2.0/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/11.2.0/firebase-analytics.js";
import {
  getStorage,
  ref,
  uploadBytes,
  getDownloadURL,
} from "https://www.gstatic.com/firebasejs/11.2.0/firebase-storage.js";

// Ваші налаштування Firebase залишаються без змін
const firebaseConfig = {
  apiKey: "AIzaSyDWLc2hvFj9H1Lxt2g9RZ3YaBziVzo6IaM",
  authDomain: "dr-dluhunovych.firebaseapp.com",
  projectId: "dr-dluhunovych",
  storageBucket: "dr-dluhunovych.firebasestorage.app",
  messagingSenderId: "1039035115906",
  appId: "1:1039035115906:web:00074738e04c271c8c079b",
  measurementId: "G-8L8RFQ2WLG",
};

// Ініціалізація Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
const db = getFirestore(app);

const authButton = document.querySelector(".universal-auth");
const loginSection = document.getElementById("login-section");
const authorizedSection = document.querySelector(".authorized-section");

// Функція отримання даних за датою
export async function fetchDataByDate(date) {
  try {
    const recordsRef = collection(db, "working_hours");
    const q = query(recordsRef, where("date", "==", date));

    console.log("🔥 Querying Firestore for date:", date); // Дивимося, яку дату передаємо
    const querySnapshot = await getDocs(q);

    let result = [];
    querySnapshot.forEach((doc) => {
      result.push({ id: doc.id, ...doc.data() });
    });

    console.log("📌 Firestore result for", date, ":", result); // Дивимося, що отримуємо

    return result;
  } catch (error) {
    console.error("❌ Помилка при отриманні даних:", error);
    return [];
  }
}

// Функція для розрахунку ЗП за день
export function calculateDailySalary(workDuration, hourlyRate) {
  const match = workDuration.match(/(\d+)\sгод\s(\d+)\sхв/);
  if (!match) return "Помилка у розрахунку!";

  const hours = parseInt(match[1]);
  const minutes = parseInt(match[2]);

  // Загальна кількість годин з урахуванням хвилин
  const totalHours = hours + minutes / 60;

  // Розрахунок заробітної плати
  const salary = totalHours * hourlyRate;

  return `${salary.toFixed(2)} грн`;
}

// Функція додавання робочих годин

// Функція для обчислення тривалості роботи у форматі "X год Y хв"
export function calculateWorkDuration(startTime, endTime) {
  // Розбиваємо строки на години та хвилини
  const [startHours, startMinutes] = startTime.split(":").map(Number);
  const [endHours, endMinutes] = endTime.split(":").map(Number);

  // Перетворюємо години та хвилини у загальну кількість хвилин
  const startTotalMinutes = startHours * 60 + startMinutes;
  const endTotalMinutes = endHours * 60 + endMinutes;

  // Розраховуємо тривалість роботи у хвилинах
  let durationMinutes = endTotalMinutes - startTotalMinutes;

  // Якщо кінець часу раніше за початок (наприклад, робота через північ)
  if (durationMinutes < 0) {
    durationMinutes += 24 * 60;
  }

  // Отримуємо години та хвилини
  const hours = Math.floor(durationMinutes / 60);
  const minutes = durationMinutes % 60;

  // Формуємо результат у форматі "X год Y хв"
  return `${hours} год ${minutes} хв`;
}

// Обробка форми для додавання нових даних
document
  .getElementById("add-form")
  .addEventListener("submit", async (event) => {
    event.preventDefault();
  });
export async function addWorkingHours(
  date,
  startTime,
  endTime,
  workDuration,
  dailySalary,
  notes
) {
  try {
    const recordsRef = collection(db, "working_hours");
    await addDoc(recordsRef, {
      date,
      startTime,
      endTime,
      workDuration,
      dailySalary,
      notes,
    });
    console.log("Дані успішно додано!");
  } catch (error) {
    console.error("Помилка при додаванні даних:", error);
  }
}

// Функція для оновлення кнопки та відображення секцій
function updateAuthState() {
  const loggedInUser = localStorage.getItem("loggedInUser");
  const statisticsSection = document.getElementById("statistics"); // Отримуємо секцію статистики

  if (loggedInUser) {
    authButton.textContent = "Вийти";
    authButton.onclick = logout;
    loginSection.style.display = "none";
    authorizedSection.style.display = "block";
    statisticsSection.style.display = "block"; // Показуємо статистику
  } else {
    authButton.textContent = "Ввійти";
    authButton.onclick = () => {
      loginSection.style.display = "block";
    };
    authorizedSection.style.display = "none";
    statisticsSection.style.display = "none"; // Ховаємо статистику
  }
}

// Функція для авторизації
async function authenticateUser(username, password) {
  document.getElementById("loading-overlay").style.display = "flex"; // Показати прелоадер

  const usersRef = collection(db, "users");
  const q = query(usersRef, where("username", "==", username));
  const querySnapshot = await getDocs(q);

  if (querySnapshot.empty) {
    alert("❌ Користувача не знайдено!");
    document.getElementById("loading-overlay").style.display = "none"; // Приховати прелоадер
    return false;
  }

  let authenticated = false;
  querySnapshot.forEach((doc) => {
    const userData = doc.data();
    if (userData.password === password) {
      console.log("✅ Авторизація успішна!");
      localStorage.setItem("loggedInUser", username);
      authenticated = true;
    }
  });

  if (!authenticated) {
    alert("❌ Невірний пароль.");
    document.getElementById("loading-overlay").style.display = "none"; // Приховати прелоадер
  }

  updateAuthState();

  // Додаємо невелику затримку перед оновленням сторінки для плавного ефекту
  setTimeout(() => {
    location.reload();
  }, 500);

  return authenticated;
}

// Обробник для форми входу
document
  .getElementById("login-form")
  .addEventListener("submit", function (event) {
    event.preventDefault();
    const username = document.getElementById("username").value;
    const password = document.getElementById("password").value;
    authenticateUser(username, password);
  });

// Функція для виходу
function logout() {
  localStorage.removeItem("loggedInUser");
  updateAuthState();
}

// Перевірка наявності даних при завантаженні сторінки
window.addEventListener("load", () => {
  updateAuthState();
});

updateAuthState();

// Функція для запуску таймера зворотного відліку
function startCountdownTimer(endTime) {
  function updateTimer() {
    const now = new Date();
    const [endHours, endMinutes] = endTime.split(":").map(Number);

    // Створюємо об'єкт часу завершення роботи
    const endDateTime = new Date();
    endDateTime.setHours(endHours, endMinutes, 0, 0);

    // Якщо кінець зміни вже настав, зупиняємо таймер
    if (now >= endDateTime) {
      document.getElementById("countdown-timer").textContent =
        "Робочий час завершився!";
      clearInterval(timerInterval);
      return;
    }

    // Розрахунок залишкового часу
    let diffMs = endDateTime - now;
    let hours = Math.floor(diffMs / (1000 * 60 * 60));
    let minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    let seconds = Math.floor((diffMs % (1000 * 60)) / 1000);

    // Форматуємо час (завжди дві цифри)
    hours = String(hours).padStart(2, "0");
    minutes = String(minutes).padStart(2, "0");
    seconds = String(seconds).padStart(2, "0");

    // Відображаємо залишковий час
    document.getElementById(
      "countdown-timer"
    ).textContent = `${hours}:${minutes}:${seconds}`;
  }

  // Оновлюємо таймер кожну секунду
  updateTimer();
  const timerInterval = setInterval(updateTimer, 1000);
}

// Запуск таймера після додавання нового запису
document
  .getElementById("add-form")
  .addEventListener("submit", async (event) => {
    event.preventDefault();

    const date = document.getElementById("add-date-input").value;
    const startTime = document.getElementById("start-time-input").value;
    const endTime = document.getElementById("end-time-input").value;
    const hourlyRate = parseFloat(document.getElementById("hourly-rate").value); // Отримуємо ставку

    // Викликаємо функцію для обчислення тривалості
    const workDuration = calculateWorkDuration(startTime, endTime);
    console.log("Обчислена тривалість:", workDuration);

    // Розраховуємо зарплату
    const dailySalary = calculateDailySalary(workDuration, hourlyRate);
    document.getElementById(
      "salary-result"
    ).textContent = `Зарплата за день: ${dailySalary} грн`;

    // Запускаємо таймер зворотного часу
    startCountdownTimer(endTime);

    await addWorkingHours(date, startTime, endTime, workDuration, dailySalary);
    alert("Дані успішно додано!");
  });
// Функція для отримання статистики за обраний період
export async function fetchStatistics(startDate, endDate) {
  if (!startDate || !endDate) {
    console.error("❌ Некоректні дати:", startDate, endDate);
    return [];
  }

  try {
    const recordsRef = collection(db, "working_hours");

    console.log(
      "🔎 Fetching from Firestore for period:",
      startDate,
      "to",
      endDate
    );

    const startDateStr =
      typeof startDate === "string"
        ? startDate
        : startDate.toISOString().split("T")[0];
    const endDateStr =
      typeof endDate === "string"
        ? endDate
        : endDate.toISOString().split("T")[0];

    console.log("🛠 Querying Firestore from", startDateStr, "to", endDateStr);

    const q = query(
      recordsRef,
      where("date", ">=", startDateStr),
      where("date", "<=", endDateStr)
    );

    const querySnapshot = await getDocs(q);

    let records = [];
    querySnapshot.forEach((doc) => {
      records.push(doc.data());
    });

    console.log("📌 Fetched records:", records);
    return records;
  } catch (error) {
    console.error("❌ Помилка при отриманні статистики:", error);
    return [];
  }
}

// Функція для обчислення статистики
export function calculateStatistics(records) {
  let totalHours = 0;
  let totalSalary = 0;
  let minHours = null; // Змінюємо на null, щоб перевірити на відсутність даних
  let maxHours = 0;
  let minSalary = null; // Змінюємо на null
  let maxSalary = 0;

  records.forEach((record) => {
    const workDuration = record.workDuration;
    const dailySalary = parseFloat(record.dailySalary.replace(" грн", ""));

    const match = workDuration.match(/(\d+)\sгод\s(\d+)\sхв/);
    if (match) {
      const hours = parseInt(match[1]);
      const minutes = parseInt(match[2]);
      const totalDurationHours = hours + minutes / 60;

      totalHours += totalDurationHours;
      totalSalary += dailySalary;

      // Обновляємо максимальні та мінімальні значення, враховуючи наявність даних
      if (minHours === null || totalDurationHours < minHours) {
        minHours = totalDurationHours;
      }
      if (totalDurationHours > maxHours) {
        maxHours = totalDurationHours;
      }

      if (minSalary === null || dailySalary < minSalary) {
        minSalary = dailySalary;
      }
      if (dailySalary > maxSalary) {
        maxSalary = dailySalary;
      }
    }
  });

  // Перевіряємо, чи є значення, якщо їх не було, виводимо 0 або повідомлення
  return {
    totalHours: totalHours || 0,
    totalSalary: totalSalary || 0,
    minHours: minHours !== null ? minHours : 0,
    maxHours: maxHours || 0,
    minSalary: minSalary !== null ? minSalary : 0,
    maxSalary: maxSalary || 0,
  };
}

export async function updateExistingWorkingHours(
  id, // id документа для оновлення
  newStartTime,
  newEndTime,
  workDuration,
  dailySalary,
  notes
) {
  try {
    const docRef = doc(db, "working_hours", id); // Знаходимо документ за id
    await updateDoc(docRef, {
      startTime: newStartTime,
      endTime: newEndTime,
      workDuration,
      dailySalary,
      notes,
    });

    console.log("Дані успішно оновлено!");
  } catch (error) {
    console.error("Помилка при оновленні даних:", error);
  }
}

export async function deleteWorkingHours(id) {
  try {
    const docRef = doc(db, "working_hours", id);
    await deleteDoc(docRef);
    console.log("Запис успішно видалено!");
  } catch (error) {
    console.error("❌ Помилка при видаленні:", error);
  }
}
