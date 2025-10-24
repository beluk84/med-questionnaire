/*
   ЧАСТЬ 3: ЛОГИКА (JAVASCRIPT)
   - Подключение клиента Supabase
   - Обработчик отправки формы
   - Клиентская валидация
   - Сбор данных (включая чекбоксы)
   - Условная логика (показ/скрытие полей)
   - Отправка данных в Supabase
   - Обработка ответа (успех/ошибка)
*/

// --- 1. Настройка Supabase ---
// Ваши реальные URL и Anon Key
const SUPABASE_URL = 'https://evvdltgtdiyjxzwthywr.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV2dmRsdGd0ZGl5anh6d3RoeXdyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQxMjMwMDIsImV4cCI6MjA2OTY5OTAwMn0.l0UFqdUpedZRQnD9CKJgF5eiCORQw_77-2An_xhP2DY';

// Проверка, что ключи установлены (закомментирована, так как ключи вставлены)
/*
if (SUPABASE_URL === 'YOUR_SUPABASE_URL' || SUPABASE_KEY === 'YOUR_SUPABASE_ANON_KEY') {
    console.warn('Внимание: не забудьте указать ваши SUPABASE_URL и SUPABASE_KEY в main.js');
}
*/

const { createClient } = window.supabase;
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// --- 2. Глобальные переменные и DOM-элементы ---
let form;
let submitBtn;
let statusMessage;
let conditionalTriggers;

// --- 3. Инициализация после загрузки DOM ---
document.addEventListener('DOMContentLoaded', () => {
    // Находим основные элементы
    form = document.getElementById('medical-form');
    submitBtn = document.getElementById('submit-btn');
    statusMessage = document.getElementById('status-message');
    
    // Находим все радио-кнопки, которые управляют другими полями
    // Мы используем data-controls для связи
    conditionalTriggers = document.querySelectorAll('input[type="radio"][data-controls]');

    if (form) {
        // Устанавливаем обработчик отправки формы
        form.addEventListener('submit', handleFormSubmit);
    }

    // Устанавливаем обработчики для условных полей
    setupConditionalLogic();
});

// --- 4. Настройка условной логики ---
function setupConditionalLogic() {
    conditionalTriggers.forEach(trigger => {
        // Мы должны слушать 'change' на ВСЕХ радио-кнопках с одинаковым 'name'
        const groupName = trigger.name;
        const radioGroup = document.querySelectorAll(`input[type="radio"][name="${groupName}"]`);
        
        radioGroup.forEach(radio => {
            radio.addEventListener('change', (event) => {
                // ID элемента, которым управляем
                const targetWrapperId = event.target.dataset.controls;
                if (!targetWrapperId) return;

                const targetWrapper = document.getElementById(targetWrapperId);
                if (!targetWrapper) return;

                // Показываем поле, только если выбрано "Да"
                if (event.target.value === 'Да' && event.target.checked) {
                    targetWrapper.style.display = 'block';
                } else {
                    targetWrapper.style.display = 'none';
                    // Очищаем поля при скрытии
                    const inputToClear = targetWrapper.querySelector('input, textarea');
                    if (inputToClear) {
                        inputToClear.value = '';
                    }
                }
            });
        });
    });
}

// --- 5. Главный обработчик отправки формы ---
async function handleFormSubmit(event) {
    event.preventDefault(); // Предотвращаем стандартную отправку

    // 1. Блокируем кнопку и очищаем сообщения
    setLoading(true);

    // 2. Клиентская валидация (простые обязательные поля)
    const patientName = document.getElementById('patient_name').value;
    const phoneNumber = document.getElementById('phone_number').value;
    const emailAddress = document.getElementById('email_address').value;
    const diagnosis = document.getElementById('diagnosis').value;

    if (!patientName || !phoneNumber || !emailAddress || !diagnosis) {
        showStatus('Пожалуйста, заполните все обязательные поля, отмеченные *.', 'error');
        setLoading(false);
        // Найдем первое незаполненное поле и сфокусируемся на нем
        form.querySelector('input[required]:invalid')?.focus();
        return;
    }

    // 3. Сбор данных из формы
    const formData = new FormData(form);
    
    // Object.fromEntries не справляется с чекбоксами (берет только последний)
    // и радио-кнопками (если не выбраны).
    // Мы соберем данные вручную для надежности.
    const dataObject = {};
    formData.forEach((value, key) => {
        // Если ключ - это preferred_messenger, мы обрабатываем его как массив
        if (key === 'preferred_messenger') {
            if (!dataObject[key]) {
                dataObject[key] = []; // Инициализируем массив
            }
            dataObject[key].push(value);
        } else {
            // Для всех остальных полей
            dataObject[key] = value;
        }
    });

    // Удаляем поле 'medical_records', так как мы не загружаем файлы в этой функции.
    // Загрузка файлов (Supabase Storage) - это отдельный, более сложный процесс.
    delete dataObject.medical_records;

    // 4. Отправка данных в Supabase
    try {
        const { data, error } = await supabase
            .from('patient_questionnaires') // Название вашей таблицы
            .insert([dataObject]) // Вставляем объект
            .select(); // Возвращаем вставленные данные

        if (error) {
            // Если Supabase возвращает ошибку
            throw error;
        }

        // 5. Успешная отправка
        console.log('Успешно отправлено:', data);
        showStatus('Анкета успешно отправлена. Мы свяжемся с вами.', 'success');
        form.reset(); // Очищаем форму
        
        // Скрываем все условные поля после очистки
        document.querySelectorAll('.conditional-field').forEach(field => {
            field.style.display = 'none';
        });

    } catch (error) {
        // 6. Обработка ошибок
        console.error('Ошибка при отправке анкеты:', error.message);
        showStatus(`Произошла ошибка: ${error.message}. Пожалуйста, попробуйте еще раз.`, 'error');
    
    } finally {
        // 7. Разблокируем кнопку в любом случае
        setLoading(false);
    }
}

// --- 6. Вспомогательные функции ---

/**
 * Управляет состоянием загрузки кнопки и формы
 * @param {boolean} isLoading - Состояние загрузки
 */
function setLoading(isLoading) {
    if (isLoading) {
        submitBtn.disabled = true;
        submitBtn.textContent = 'Отправка...';
        statusMessage.textContent = '';
        statusMessage.className = '';
    } else {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Отправить анкету';
    }
}

/**
 * Показывает сообщение о статусе (ошибка или успех)
 * @param {string} message - Текст сообщения
 * @param {'success' | 'error'} type - Тип сообщения
 */
function showStatus(message, type) {
    statusMessage.textContent = message;
    statusMessage.className = type; // 'success' или 'error'
    statusMessage.style.display = 'block';
}

