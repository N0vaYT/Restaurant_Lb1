class Reservation {
    constructor(clientName, phone, date, time, guests, tableNumber, id = null) {
        this.id = id || crypto.randomUUID();
        this.clientName = clientName.trim();
        this.phone = phone.trim();
        this.date = date;
        this.time = time;
        this.guests = parseInt(guests, 10);
        this.tableNumber = parseInt(tableNumber, 10);
    }
}

class Table {
    constructor(number, capacity, status = "available") {
        this.number = number;
        this.capacity = capacity;
        this.status = status;
    }
}

class BookingManager {
    constructor() {
        this.items = [];
        this.tables = [
            new Table(1, 2),
            new Table(2, 2),
            new Table(3, 4),
            new Table(4, 4),
            new Table(5, 4),
            new Table(6, 6),
            new Table(7, 6),
            new Table(8, 8),
            new Table(9, 10),
            new Table(10, 20)
        ];
        this.loadFromStorage();
    }

    add(reservation) {
        this.items.push(reservation);
        this.saveToStorage();
    }

    update(updatedReservation) {
        const index = this.items.findIndex(item => item.id === updatedReservation.id);
        if (index !== -1) {
            this.items[index] = updatedReservation;
            this.saveToStorage();
        }
    }

    remove(id) {
        this.items = this.items.filter(item => item.id !== id);
        this.saveToStorage();
    }

    getById(id) {
        return this.items.find(item => item.id === id);
    }

    getTableByNumber(tableNumber) {
        return this.tables.find(t => t.number === parseInt(tableNumber, 10));
    }

    checkCapacity(tableNumber, guests) {
        const table = this.getTableByNumber(tableNumber);
        if (!table) return false;
        return parseInt(guests, 10) <= table.capacity;
    }

    updateTablesStatus(date, time, excludeId = null) {
        this.tables.forEach(table => {
            if (!date || !time) {
                table.status = "available";
            } else {
                const isBooked = this.checkConflict(date, time, table.number, excludeId);
                table.status = isBooked ? "booked" : "available";
            }
        });
    }

    getFiltered(date, searchQuery = "") {
        const query = searchQuery.trim().toLowerCase();
        return this.items
            .filter(item => {
                const matchesDate = item.date === date;
                const matchesSearch = !query ||
                    item.clientName.toLowerCase().includes(query) ||
                    item.phone.toLowerCase().includes(query);
                return matchesDate && matchesSearch;
            })
            .sort((a, b) => a.time.localeCompare(b.time));
    }

    getUniqueDates() {
        const dates = this.items.map(item => item.date);
        return [...new Set(dates)].sort();
    }

    // Перевірка конфлікту: столик зайнятий, якщо різниця менше 2 годин
    checkConflict(date, time, tableNumber, excludeId = null) {
        const newBookingTime = new Date(`${date}T${time}`).getTime();
        const tableNum = parseInt(tableNumber, 10);

        return this.items.some(item => {
            if (item.id === excludeId) return false;
            if (item.date !== date || item.tableNumber !== tableNum) return false;

            const existingTime = new Date(`${item.date}T${item.time}`).getTime();
            const diffHours = Math.abs(existingTime - newBookingTime) / (1000 * 60 * 60);
            return diffHours < 2;
        });
    }

    saveToStorage() {
        localStorage.setItem("reservations", JSON.stringify(this.items));
    }

    loadFromStorage() {
        const saved = localStorage.getItem("reservations");
        if (saved) {
            this.items = JSON.parse(saved);
        }
    }
}

const manager = new BookingManager();
let currentTabDate = manager.getUniqueDates()[0] || getTodayLocalDate();
let pendingDeleteId = null;
let lastFocusedElement = null;

const patterns = {
    clientName: /^[\p{L}\s'-]{2,50}$/u,
    phone: /^(\+380|0)\d{9}$/,
    date: /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/,
    time: /^(1\d|2[0-2]):[0-5]\d$/ // Робочі години: 10:00–22:59
};

const form = document.getElementById("booking-form");
const formTitle = document.getElementById("form-title");
const dateField = document.getElementById("date");
const timeField = document.getElementById("time");
const tableField = document.getElementById("tableNumber");
const listContainer = document.getElementById("reservations-list");
const tabsContainer = document.getElementById("tabs-nav");
const searchInput = document.getElementById("search-input");
const conflictMsg = document.getElementById("conflict-msg");
const cancelEditBtn = document.getElementById("cancel-edit-btn");
const submitBtn = document.getElementById("submit-btn");

const modal = document.getElementById("confirm-modal");
const modalText = document.getElementById("modal-text");
const modalConfirmBtn = document.getElementById("modal-confirm-btn");
const modalCancelBtn = document.getElementById("modal-cancel-btn");

function getTodayLocalDate() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
}

function renderTableOptions(excludeId = null) {
    const previousValue = tableField.value;
    manager.updateTablesStatus(dateField.value, timeField.value, excludeId);
    tableField.innerHTML = "";

    manager.tables.forEach(table => {
        const option = document.createElement("option");
        option.value = table.number;
        const statusLabel = table.status === "booked" ? " — Зайнятий" : "";
        option.textContent = `Стіл №${table.number} (до ${table.capacity} осіб)${statusLabel}`;
        tableField.append(option);
    });

    if (previousValue) {
        tableField.value = previousValue;
    }
}

function renderTabs() {
    tabsContainer.innerHTML = "";
    const dates = manager.getUniqueDates();

    if (dates.length === 0) {
        currentTabDate = getTodayLocalDate();
        return;
    }

    if (!dates.includes(currentTabDate)) {
        currentTabDate = dates[0];
    }

    dates.forEach(date => {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = `tab-btn ${date === currentTabDate ? "active" : ""}`;
        btn.textContent = date.split("-").reverse().join(".");
        btn.dataset.date = date;

        tabsContainer.append(btn);
    });
}

function renderList() {
    listContainer.innerHTML = "";
    const items = manager.getFiltered(currentTabDate, searchInput.value);

    if (items.length === 0) {
        const empty = document.createElement("p");
        empty.className = "empty-state";
        empty.textContent = searchInput.value.trim()
            ? "За вашим запитом бронювань не знайдено."
            : "На цю дату бронювань немає.";
        listContainer.append(empty);
        return;
    }

    items.forEach(item => {
        const li = document.createElement("li");
        li.className = "reservation-item";
        li.dataset.id = item.id;

        const info = document.createElement("div");
        info.className = "reservation-info";
        info.innerHTML = `
            <strong>🍽️ Стіл №${item.tableNumber} — 🕒 ${item.time}</strong>
            <span>👤 ${item.clientName} | 📞 ${item.phone}</span>
            <span>👥 Кількість осіб: ${item.guests}</span>
        `;

        const actions = document.createElement("div");
        actions.className = "item-actions";

        const editBtn = document.createElement("button");
        editBtn.type = "button";
        editBtn.className = "edit-btn";
        editBtn.textContent = "Редагувати";

        const delBtn = document.createElement("button");
        delBtn.type = "button";
        delBtn.className = "delete-btn";
        delBtn.textContent = "Скасувати";

        actions.append(editBtn, delBtn);
        li.append(info, actions);
        listContainer.append(li);
    });
}

function validateField(input, pattern, errorEl, message) {
    const value = input.value.trim();
    if (!pattern.test(value)) {
        input.classList.add("invalid");
        errorEl.textContent = message;
        return false;
    }
    input.classList.remove("invalid");
    errorEl.textContent = "";
    return true;
}

function validateNumberRange(input, min, max, errorEl, message) {
    const num = parseInt(input.value, 10);
    if (Number.isNaN(num) || num < min || num > max) {
        input.classList.add("invalid");
        errorEl.textContent = message;
        return false;
    }
    input.classList.remove("invalid");
    errorEl.textContent = "";
    return true;
}

function validateCrossDate(dateInput, timeInput) {
    const errorDate = document.getElementById("error-date");
    const errorTime = document.getElementById("error-time");
    const dateVal = dateInput.value;
    const timeVal = timeInput.value;

    if (!dateVal) return false;

    const today = getTodayLocalDate();

    if (dateVal < today) {
        dateInput.classList.add("invalid");
        errorDate.textContent = "Не можна обрати минулу дату";
        return false;
    }

    dateInput.classList.remove("invalid");
    errorDate.textContent = "";

    if (dateVal === today && timeVal) {
        const selectedDateTime = new Date(`${dateVal}T${timeVal}`);
        if (selectedDateTime < new Date()) {
            timeInput.classList.add("invalid");
            errorTime.textContent = "Час бронювання не може бути в минулому";
            return false;
        }
        timeInput.classList.remove("invalid");
        errorTime.textContent = "";
    }

    return true;
}

function resetFormState() {
    form.reset();
    document.getElementById("edit-id").value = "";
    formTitle.textContent = "Нове бронювання";
    submitBtn.textContent = "Зберегти бронювання";
    cancelEditBtn.classList.add("hidden");
    conflictMsg.textContent = "";
    form.querySelectorAll(".invalid").forEach(el => el.classList.remove("invalid"));
    form.querySelectorAll(".error-msg").forEach(el => (el.textContent = ""));
    renderTableOptions();
}

function openDeleteModal(id, triggerElement) {
    const item = manager.getById(id);
    if (!item) return;

    pendingDeleteId = id;
    lastFocusedElement = triggerElement;
    modalText.textContent = `Скасувати бронювання столика №${item.tableNumber} для ${item.clientName} на ${item.time}?`;

    modal.classList.remove("hidden");
    modalConfirmBtn.focus();
}

function closeDeleteModal() {
    modal.classList.add("hidden");
    pendingDeleteId = null;

    if (lastFocusedElement && document.body.contains(lastFocusedElement)) {
        lastFocusedElement.focus();
    }
    lastFocusedElement = null;
}

// Обробка подій
dateField.addEventListener("change", () => {
    validateCrossDate(dateField, timeField);
    renderTableOptions(document.getElementById("edit-id").value || null);
});

timeField.addEventListener("change", () => {
    if (dateField.value) {
        validateCrossDate(dateField, timeField);
    }
    renderTableOptions(document.getElementById("edit-id").value || null);
});

form.addEventListener("submit", event => {
    event.preventDefault();
    conflictMsg.textContent = "";

    const editId = document.getElementById("edit-id").value;
    const nameInput = document.getElementById("clientName");
    const phoneInput = document.getElementById("phone");
    const guestsInput = document.getElementById("guests");
    const errorTable = document.getElementById("error-tableNumber");

    const isNameValid = validateField(
        nameInput,
        patterns.clientName,
        document.getElementById("error-clientName"),
        "Введіть коректне ім'я (2–50 символів)"
    );
    const isPhoneValid = validateField(
        phoneInput,
        patterns.phone,
        document.getElementById("error-phone"),
        "Формат: +380XXXXXXXXX або 0XXXXXXXXX"
    );
    const isDateValid = validateField(
        dateField,
        patterns.date,
        document.getElementById("error-date"),
        "Оберіть коректну дату"
    );
    const isTimeValid = validateField(
        timeField,
        patterns.time,
        document.getElementById("error-time"),
        "Ресторан працює з 10:00 до 22:59"
    );
    const isGuestsValid = validateNumberRange(
        guestsInput, 1, 20,
        document.getElementById("error-guests"),
        "Від 1 до 20 осіб"
    );

    if (!isNameValid || !isPhoneValid || !isDateValid || !isTimeValid || !isGuestsValid) {
        return;
    }

    if (!validateCrossDate(dateField, timeField)) {
        return;
    }

    // Перевірка місткості столика
    if (!manager.checkCapacity(tableField.value, guestsInput.value)) {
        const selectedTable = manager.getTableByNumber(tableField.value);
        tableField.classList.add("invalid");
        errorTable.textContent = `Стіл №${selectedTable.number} розрахований максимум на ${selectedTable.capacity} осіб`;
        return;
    }
    tableField.classList.remove("invalid");
    errorTable.textContent = "";

    // Перевірка зайнятості столика
    if (manager.checkConflict(dateField.value, timeField.value, tableField.value, editId || null)) {
        conflictMsg.textContent = `Столик №${tableField.value} на цей час вже заброньовано (інтервал 2 год).`;
        return;
    }

    const reservation = new Reservation(
        nameInput.value,
        phoneInput.value,
        dateField.value,
        timeField.value,
        guestsInput.value,
        tableField.value,
        editId || null
    );

    if (editId) {
        manager.update(reservation);
    } else {
        manager.add(reservation);
    }

    currentTabDate = dateField.value;
    resetFormState();
    renderTabs();
    renderList();
});

tabsContainer.addEventListener("click", event => {
    const btn = event.target.closest(".tab-btn");
    if (!btn) return;

    currentTabDate = btn.dataset.date;
    renderTabs();
    renderList();
});

listContainer.addEventListener("click", event => {
    const itemEl = event.target.closest(".reservation-item");
    if (!itemEl) return;

    const id = itemEl.dataset.id;

    if (event.target.closest(".delete-btn")) {
        openDeleteModal(id, event.target);
    } else if (event.target.closest(".edit-btn")) {
        const item = manager.getById(id);
        if (!item) return;

        document.getElementById("edit-id").value = item.id;
        document.getElementById("clientName").value = item.clientName;
        document.getElementById("phone").value = item.phone;
        dateField.value = item.date;
        timeField.value = item.time;
        document.getElementById("guests").value = item.guests;

        renderTableOptions(item.id);
        tableField.value = item.tableNumber;

        formTitle.textContent = "Редагування бронювання";
        submitBtn.textContent = "Оновити бронювання";
        cancelEditBtn.classList.remove("hidden");
        conflictMsg.textContent = "";

        window.scrollTo({ top: 0, behavior: "smooth" });
    }
});

searchInput.addEventListener("input", renderList);

cancelEditBtn.addEventListener("click", resetFormState);

modalConfirmBtn.addEventListener("click", () => {
    if (pendingDeleteId) {
        if (document.getElementById("edit-id").value === pendingDeleteId) {
            resetFormState();
        }
        manager.remove(pendingDeleteId);
        renderTableOptions(document.getElementById("edit-id").value || null);
        renderTabs();
        renderList();
    }
    closeDeleteModal();
});

modalCancelBtn.addEventListener("click", closeDeleteModal);

modal.addEventListener("click", event => {
    if (event.target === modal) {
        closeDeleteModal();
    }
});

document.addEventListener("keydown", event => {
    if (event.key === "Escape" && !modal.classList.contains("hidden")) {
        closeDeleteModal();
    }
});

renderTableOptions();
renderTabs();
renderList();