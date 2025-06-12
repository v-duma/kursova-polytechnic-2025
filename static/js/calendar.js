document.addEventListener("DOMContentLoaded", function () {
  const calendarEl = document.getElementById("calendar");
  const modal = document.getElementById("modal");
  const modalContent = document.getElementById("modal-content");

  let hourlyRate = parseFloat(localStorage.getItem("hourlyRate")) || 0;
  const rateContainer = document.createElement("p");
  const rateInput = document.createElement("input");
  rateInput.type = "number";
  rateInput.value = hourlyRate;
  rateInput.placeholder = "Ставка за годину (грн)";
  rateInput.style = "width: 100px;";
  rateInput.addEventListener("change", function () {
    hourlyRate = parseFloat(this.value);
    localStorage.setItem("hourlyRate", hourlyRate);
  });
  rateContainer.innerHTML = "Ставка за годину:";
  rateContainer.appendChild(rateInput);
  document.querySelector("h2").after(rateContainer);

  const calendar = new FullCalendar.Calendar(calendarEl, {
    initialView: "dayGridMonth",
    locale: "uk",
    headerToolbar: {
      left: "today",
      center: "title",
      right: "prev,next",
    },
    events: "/events",
    dateClick: function (info) {
      fetch(`/event/${info.dateStr}`)
        .then((res) => res.json())
        .then((data) => {
          if (data && data.start) {
            showEventView(info.dateStr, data);
          } else {
            showAddForm(info.dateStr);
          }
        });
    },
  });
  calendar.render();

  function closeModal() {
    modal.classList.add("hidden");
    modalContent.innerHTML = "";
  }

  function showAddForm(date) {
    modalContent.innerHTML = `
      <div class="close-btn" id="modal-close">✖</div>
      <h2>${formatDate(date)}</h2>
      <p>Заповніть інформацію про цей день</p>
      <label>Час початку:</label>
      <input type="time" id="start">
      <label>Час завершення:</label>
      <input type="time" id="end">
      <label>Примітки:</label>
      <textarea id="notes" placeholder="Що цікавого?"></textarea>
      <button class="blue save-button" id="save-button" style="width: 100%">Додати</button>
    `;
    modal.classList.remove("hidden");

    document
      .getElementById("modal-close")
      .addEventListener("click", closeModal);
    document
      .getElementById("save-button")
      .addEventListener("click", () => saveEvent(date));
  }

  function showEventView(date, data) {
    const start = data.start;
    const end = data.end;
    const duration = calculateDuration(start, end);
    modalContent.innerHTML = `
      <div class="close-btn" id="modal-close">✖</div>
      <h2>${formatDate(date)}</h2>
      <p><strong>Час:</strong> ${start} - ${end}</p>
      <p><strong>Тривалість:</strong> ${duration}</p>
      <p><strong>Примітки:</strong> ${data.notes || "Не вказано"}</p>
      <p><strong>Сума:</strong> ${data.salary.toFixed(2)} грн</p>
      <button class="blue" id="edit-button">Редагувати</button>
      <button class="red" id="delete-button">Видалити</button>
    `;
    modal.classList.remove("hidden");

    document
      .getElementById("modal-close")
      .addEventListener("click", closeModal);
    document
      .getElementById("edit-button")
      .addEventListener("click", () =>
        showEditForm(date, data.id, start, end, data.notes, data.salary)
      );
    document
      .getElementById("delete-button")
      .addEventListener("click", () => deleteEvent(data.id));
  }

  function showEditForm(date, id, start, end, notes, salary) {
    modalContent.innerHTML = `
      <div class="close-btn" id="modal-close">✖</div>
      <h2>${formatDate(date)}</h2>
      <label>Час початку:</label>
      <input type="time" id="start" value="${start}">
      <label>Час завершення:</label>
      <input type="time" id="end" value="${end}">
      <label>Примітки:</label>
      <textarea id="notes">${notes}</textarea>
      <button class="blue save-button" id="save-button">Зберегти</button>
    `;
    modal.classList.remove("hidden");

    document
      .getElementById("modal-close")
      .addEventListener("click", closeModal);
    document
      .getElementById("save-button")
      .addEventListener("click", () => saveEvent(date, id));
  }

  function saveEvent(date, id = null) {
    const start = document.getElementById("start").value;
    const end = document.getElementById("end").value;
    const [h1, m1] = start.split(":").map(Number);
    const [h2, m2] = end.split(":").map(Number);
    const mins = h2 * 60 + m2 - (h1 * 60 + m1);
    const duration = mins / 60;
    const salary = Math.round(duration * hourlyRate * 100) / 100;

    const data = {
      date: date,
      start: start,
      end: end,
      notes: document.getElementById("notes").value,
      salary: salary,
    };

    fetch("/event", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    }).then(() => {
      calendar.refetchEvents();
      closeModal();
    });
  }

  function deleteEvent(id) {
    fetch(`/event/delete/${id}`, { method: "POST" }).then(() => {
      calendar.refetchEvents();
      closeModal();
    });
  }

  function formatDate(dateStr) {
    const d = new Date(dateStr);
    return d.toLocaleDateString("uk-UA", {
      day: "2-digit",
      month: "long",
      year: "numeric",
    });
  }

  function calculateDuration(start, end) {
    const [h1, m1] = start.split(":").map(Number);
    const [h2, m2] = end.split(":").map(Number);
    let mins = h2 * 60 + m2 - (h1 * 60 + m1);
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return `${h} год ${m} хв`;
  }

  // ---------- Статистика ----------

  document
    .getElementById("period-select")
    .addEventListener("change", function () {
      if (this.value === "custom") {
        document.getElementById("custom-period").style.display = "block";
      } else {
        document.getElementById("custom-period").style.display = "none";
        fetchStatistics(this.value);
      }
    });

  document
    .getElementById("get-statistics")
    .addEventListener("click", function () {
      const start = document.getElementById("start-date").value;
      const end = document.getElementById("end-date").value;
      if (start && end) {
        fetchStatistics("custom", start, end);
      }
    });

  function fetchStatistics(period, start_date = null, end_date = null) {
    fetch("/statistics", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ period, start_date, end_date }),
    })
      .then((res) => res.json())
      .then((data) => {
        document.getElementById("total-hours").textContent =
          "Загальна кількість годин: " + data.total_hours;
        document.getElementById("total-salary").textContent =
          "Загальна зарплата: " + data.total_salary + " грн";
        document.getElementById("max-hours").textContent =
          "Максимальна кількість годин у день: " + data.max_hours + " год";
        document.getElementById("min-hours").textContent =
          "Мінімальна кількість годин у день: " + data.min_hours + " год";
        document.getElementById("max-salary").textContent =
          "Максимальна зарплата за день: " + data.max_salary + " грн";
        document.getElementById("min-salary").textContent =
          "Мінімальна зарплата за день: " + data.min_salary + " грн";

        [
          "total-hours",
          "total-salary",
          "max-hours",
          "min-hours",
          "max-salary",
          "min-salary",
          "view-daily-statistics",
        ].forEach(
          (id) => (document.getElementById(id).style.display = "block")
        );

        document.getElementById("view-daily-statistics").onclick = function () {
          const container = document.getElementById("daily-details-content");
          container.innerHTML = "";
          data.details.forEach((entry) => {
            container.innerHTML += `<p><strong>${entry.date}:</strong> ${entry.duration} год — ${entry.salary} грн</p>`;
          });
          document.getElementById("details-modal").style.display = "block";
        };
      });
  }

  document.querySelector(".close-modal").addEventListener("click", function () {
    document.getElementById("details-modal").style.display = "none";
  });
});
