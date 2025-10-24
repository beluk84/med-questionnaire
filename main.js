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

    // --- НОВЫЙ БЛОК: ЗАГРУЗКА ФАЙЛОВ ---
    const files = document.getElementById('medical_records').files;
    const uploadPromises = [];
    // Уникальный ID для этой отправки, чтобы сгруппировать файлы в хранилище
    const submissionId = crypto.randomUUID(); 
    const uploadedFileUrls = [];

    if (files.length > 0) {
        for (const file of files) {
            // Генерируем уникальное имя файла, сохраняя расширение
            const fileExt = file.name.split('.').pop();
            const uniqueFileName = `${crypto.randomUUID()}.${fileExt}`;
            // Путь: submissions/{id_заявки}/{уникальное_имя_файла}
            // Это организует файлы по заявкам
            const filePath = `submissions/${submissionId}/${uniqueFileName}`;

            // Добавляем обещание загрузки в массив
            uploadPromises.push(
                supabase.storage
                    .from('medical_records') // Название нашего Бакета
                    .upload(filePath, file)
            );
        }
    }

    try {
        // Ждем завершения всех загрузок параллельно
        const uploadResults = await Promise.all(uploadPromises);
        
        // Проверяем на ошибки и собираем URL
        for (const result of uploadResults) {
            if (result.error) {
                // Если хоть один файл не загрузился, прерываем
                throw new Error(`Ошибка загрузки файла: ${result.error.message}`);
            }
            // Получаем публичный URL для успешно загруженного файла
            const { data: urlData } = supabase.storage
                .from('medical_records')
                .getPublicUrl(result.data.path);
            
            if (urlData) {
                uploadedFileUrls.push(urlData.publicUrl);
            }
        }
    
    } catch (uploadError) {
         console.error('Ошибка в процессе загрузки файла:', uploadError);
         // Показываем ошибку пользователю и останавливаем отправку
         showStatus(`Ошибка загрузки файла: ${uploadError.message}. Отправка отменена.`, 'error');
         setLoading(false);
         return; // Прерываем выполнение функции
    }
    // --- КОНЕЦ НОВОГО БЛОКА ---


    // 3. Сбор данных из формы
    const formData = new FormData(form);
    
    // ... (существующий код сбора dataObject) ...
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
            // *** ИСПРАВЛЕНИЕ: ***
            // Если значение - пустая строка, отправляем null.
            // Это исправляет ошибку "invalid input syntax for type date".
            dataObject[key] = value === "" ? null : value;
        }
    });

    // Удаляем поле 'medical_records', так как мы не хотим слать FileList в БД
    delete dataObject.medical_records;

    // !! ДОБАВЛЯЕМ ССЫЛКИ НА ФАЙЛЫ В НАШ ОБЪЕКТ !!
    // Сохраняем массив URL (или null, если файлов не было)
    dataObject.medical_record_urls = uploadedFileUrls.length > 0 ? uploadedFileUrls : null;


    // 4. Отправка данных в Supabase
    try {
        // ИЗМЕНЕНИЕ: Мы убираем .select(), чтобы избежать проблем с RLS (Row Level Security)
        // Нам не нужно читать данные после вставки, нам достаточно знать, что нет ошибки.
        const { error } = await supabase
            .from('patient_questionnaires') // Название вашей таблицы
            .insert([dataObject]); // Вставляем объект

        if (error) {
            // Если Supabase возвращает ошибку
            throw error;
        }

        // 5. Успешная отправка
        // 'data' теперь будет null, так как мы убрали .select(), это нормально.
        console.log('Анкета и файлы успешно отправлены.');
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



