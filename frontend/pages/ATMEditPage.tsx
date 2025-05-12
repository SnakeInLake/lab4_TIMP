// src/pages/ATMEditPage.tsx
import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import apiClient from '../services/api';
import type { ATM, ATMStatus, User } from '../src/types'; // Импортируем типы
import styles from './FormStyles.module.css'; // Стили для формы

// Определяем пропсы (для передачи currentUser, если проверка прав на клиенте)
interface ATMEditPageProps {
    currentUser: User | null; 
}

const ATMEditPage: React.FC<ATMEditPageProps> = ({ currentUser }) => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  // Состояния формы (аналогичны полям в ATMUpdate схеме)
  const [atmUid, setAtmUid] = useState('');
  const [location, setLocation] = useState('');
  const [ipAddress, setIpAddress] = useState('');
  const [statusId, setStatusId] = useState<number | ''>(''); // Используем '' для пустого значения в select

  // Состояния для загрузки данных и ошибок
  const [atm, setAtm] = useState<ATM | null>(null); // Храним оригинальные данные ATM
  const [statuses, setStatuses] = useState<ATMStatus[]>([]); // Для выпадающего списка статусов
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false); // Для кнопки сохранения
  const [error, setError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null); // Ошибки валидации формы/API

  // Функция загрузки деталей ATM и списка статусов
  const fetchData = useCallback(async () => {
     if (!id) {
         setError("ID банкомата не указан.");
         setLoading(false);
         return;
     }
     setLoading(true);
     setError(null);
     setFormError(null);
     try {
        // Загружаем параллельно детали ATM и список статусов
        const [atmResponse, statusesResponse] = await Promise.all([
            apiClient.get<ATM>(`/atms/${id}`),
            apiClient.get<ATMStatus[]>('/atms/statuses/') // ПРЕДПОЛАГАЕМ, что такой эндпоинт есть или будет!
        ]);

        const fetchedAtm = atmResponse.data;
        setAtm(fetchedAtm);
        setStatuses(statusesResponse.data);

        // Заполняем форму начальными данными
        setAtmUid(fetchedAtm.atm_uid);
        setLocation(fetchedAtm.location_description || '');
        setIpAddress(fetchedAtm.ip_address || '');
        setStatusId(fetchedAtm.status_id);

        // Проверка прав доступа на редактирование (можно положиться на API, но для UI лучше проверить)
        if (!(currentUser && (currentUser.id === fetchedAtm.added_by_user_id || currentUser.role === 'admin' || currentUser.role === 'superadmin'))) {
            setError("У вас нет прав на редактирование этого банкомата.");
        }

     } catch (err: any) {
        console.error(`Failed to fetch data for ATM ${id}:`, err);
         if (err.response?.status === 404) {
             setError('Банкомат или статусы не найдены.');
         } else {
             setError(err.response?.data?.detail || err.message || 'Не удалось загрузить данные.');
         }
     } finally {
        setLoading(false);
     }
  }, [id, currentUser]); // Зависимость от id и currentUser

  useEffect(() => {
      fetchData();
  }, [fetchData]); // Вызываем при монтировании и при изменении fetchData

  // Обработчик сохранения
  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!id || error) return; // Не сохраняем, если есть ошибка загрузки или нет ID

    setSaving(true);
    setFormError(null);

    const updateData: { [key: string]: any } = {};
    // Собираем только измененные данные (опционально, API ожидает частичное обновление)
    if (atmUid !== atm?.atm_uid) updateData.atm_uid = atmUid;
    if (location !== (atm?.location_description || '')) updateData.location_description = location;
    if (ipAddress !== (atm?.ip_address || '')) updateData.ip_address = ipAddress;
    if (statusId !== '' && statusId !== atm?.status_id) updateData.status_id = statusId;

    // Проверяем, есть ли что обновлять
    if (Object.keys(updateData).length === 0) {
        setFormError("Нет изменений для сохранения.");
        setSaving(false);
        return;
    }
    
    try {
        await apiClient.put(`/atms/${id}`, updateData);
        alert('Данные банкомата успешно обновлены.');
        navigate(`/atms/${id}`); // Возвращаемся на страницу деталей
    } catch (err: any) {
        console.error(`Failed to update ATM ${id}:`, err);
        // err.response?.data?.detail МОЖЕТ БЫТЬ МАССИВОМ ОБЪЕКТОВ
        // или строкой, если это другое сообщение об ошибке от вашего API.
        // Нужно это обработать.
    
        let errorMessage = 'Не удалось обновить банкомат.'; // Сообщение по умолчанию
    
        if (err.response?.data?.detail) {
            const details = err.response.data.detail;
            if (Array.isArray(details)) {
                // Если это массив ошибок валидации, берем сообщения из них
                errorMessage = details.map(d => d.msg).join('; ');
            } else if (typeof details === 'string') {
                // Если это просто строка
                errorMessage = details;
            } else {
                // Если это какой-то другой объект, пытаемся его привести к строке (не лучший вариант, но для начала)
                errorMessage = JSON.stringify(details);
            }
        } else if (err.message) {
            errorMessage = err.message;
        }
        setFormError(errorMessage);
    } finally {
        setSaving(false);
    }
  };


  if (loading) return <div>Загрузка данных для редактирования...</div>;
  if (error) return <div style={{ color: 'red' }}>Ошибка: {error}</div>;
  if (!atm) return <div>Банкомат не найден.</div>; // Если после загрузки ATM все еще null

  // Форма редактирования
  return (
    <div className={styles.formContainer}>
        <h2>Редактировать Банкомат: {atm.atm_uid}</h2>
        <form onSubmit={handleSubmit}>
            <div className={styles.formGroup}>
                <label htmlFor="edit-atm-uid">UID Банкомата:</label>
                <input
                    type="text"
                    id="edit-atm-uid"
                    value={atmUid}
                    onChange={(e) => setAtmUid(e.target.value)}
                    required
                    className={styles.formInput}
                />
            </div>
            <div className={styles.formGroup}>
                <label htmlFor="edit-location">Местоположение:</label>
                <input
                    type="text"
                    id="edit-location"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    className={styles.formInput}
                />
            </div>
            <div className={styles.formGroup}>
                <label htmlFor="edit-ip">IP Адрес:</label>
                <input
                    type="text"
                    id="edit-ip"
                    value={ipAddress}
                    onChange={(e) => setIpAddress(e.target.value)}
                    className={styles.formInput}
                />
            </div>
             <div className={styles.formGroup}>
                <label htmlFor="edit-status">Статус:</label>
                <select
                    id="edit-status"
                    value={statusId}
                    onChange={(e) => setStatusId(e.target.value === '' ? '' : parseInt(e.target.value, 10))}
                    required
                    className={styles.formInput}
                >
                    <option value="" disabled>Выберите статус</option>
                    {statuses.map(status => (
                        <option key={status.id} value={status.id}>
                            {status.name}
                        </option>
                    ))}
                </select>
            </div>

            {formError && <p className={styles.errorText}>{formError}</p>}

                {/* Блок с кнопками */}
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '25px' }}>
                    <button 
                        type="button" 
                        // Переход на страницу деталей при отмене
                        onClick={() => navigate(`/atms/${id}`)} 
                        className={styles.submitButton} 
                        style={{ backgroundColor: '#6c757d', width: '48%'}}
                        disabled={saving} // Блокируем кнопку отмены во время сохранения
                    >
                        Отмена
                    </button>
                    <button 
                        type="submit" // Кнопка отправки формы
                        disabled={saving} // Блокируем во время отправки
                        className={styles.submitButton} 
                        style={{ width: '48%'}}
                    >
                        {saving ? 'Сохранение...' : 'Сохранить'}
                    </button>
                </div>
            </form> {/* Конец формы */}
        </div> // Конец formContainer
      ); // Конец return
    }; // Конец объявления компонента ATMEditPage

export default ATMEditPage; // Экспорт компонента