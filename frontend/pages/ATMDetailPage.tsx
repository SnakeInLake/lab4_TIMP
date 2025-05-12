// src/pages/ATMDetailPage.tsx
import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom'; 
import apiClient from '../services/api';
import type { ATM, User } from '../src/types'; // Импорт типов
interface ATMDetailPageProps { currentUser: User | null }
// Определяем тип пропсов для этого компонента
interface ATMDetailPageProps {
    currentUser: User | null; // Компонент будет получать текущего пользователя
}

// Указываем React.FC, что компонент принимает пропсы типа ATMDetailPageProps
const ATMDetailPage: React.FC<ATMDetailPageProps> = ({ currentUser }) => { // Деструктурируем currentUser из пропсов
  const { id } = useParams<{ id: string }>(); 
  const navigate = useNavigate(); 

  const [atm, setAtm] = useState<ATM | null>(null); 
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchATMDetail = async () => {
      if (!id) { 
        setError('ID банкомата не указан.');
        setLoading(false);
        return;
      }
      setLoading(true);
      setError(null);
      try {
        const response = await apiClient.get<ATM>(`/atms/${id}`);
        setAtm(response.data);
      } catch (err: any) {
        console.error(`Failed to fetch ATM ${id}:`, err);
        if (err.response?.status === 404) {
            setError('Банкомат не найден.');
        } else {
            setError(err.response?.data?.detail || err.message || 'Не удалось загрузить данные банкомата.');
        }
      } finally {
        setLoading(false);
      }
    };

    fetchATMDetail();
  }, [id]); 
  // ...
  if (loading) {
    return <div>Загрузка данных банкомата...</div>;
  }

  if (error) {
    return <div style={{ color: 'red' }}>Ошибка: {error}</div>;
  }

  // Вот эта проверка должна отсечь null
  if (!atm) { 
    // Если мы здесь, значит, не загрузка, не ошибка, но atm все еще null? 
    // Возможно, если API вернуло пустой ответ или статус не 200/404.
    // Или если fetchATMDetail завершился без установки atm и без ошибки.
    return <div>Данные банкомата не найдены (или не загружены).</div>; 
  }

  // Если код дошел сюда, TypeScript должен быть уверен, что atm НЕ null.
  // НО! Иногда TS все равно может жаловаться.

  const handleDelete = async () => {
      if (!atm || !currentUser) return; // Добавили проверку currentUser
      // Проверка прав на удаление (только admin/superadmin)
      if (currentUser.role !== 'admin' && currentUser.role !== 'superadmin') {
          setError("У вас нет прав для удаления этого банкомата.");
          return;
      }

      if (window.confirm(`Вы уверены, что хотите удалить банкомат ${atm.atm_uid} (ID: ${atm.id})? ...`)) {
          // ... остальная логика удаления ...
           setLoading(true); 
           setError(null);
           try {
               await apiClient.delete(`/atms/${atm.id}`);
               alert('Банкомат успешно удален.');
               navigate('/atms'); 
           } catch (err: any) {
               console.error(`Failed to delete ATM ${id}:`, err);
               setError(err.response?.data?.detail || err.message || 'Не удалось удалить банкомат.');
               setLoading(false); 
           }
      }
  }
  
  // Определяем права доступа для кнопок, используя currentUser из пропсов
  const canEdit = currentUser && atm && (currentUser.id === atm.added_by_user_id || currentUser.role === 'admin' || currentUser.role === 'superadmin');
  const canDelete = currentUser && (currentUser.role === 'admin' || currentUser.role === 'superadmin');



  return (
    <div>
      <h2>Детали Банкомата: {atm.atm_uid}</h2>
      <button onClick={() => navigate('/atms')} style={{ marginRight: '10px' }}>Назад к списку</button>
      
      {/* Условный рендеринг кнопок */}
      {canEdit && (
          <button         onClick={() => navigate(`/atms/${id}/edit`)}

              style={{ marginRight: '10px' }}
          >
              Редактировать
          </button>
      )}
      {canDelete && (
          <button onClick={handleDelete} style={{ backgroundColor: '#dc3545', color: 'white' }}>
              Удалить банкомат
          </button>
      )}
      
      <div style={{ marginTop: '20px', border: '1px solid #eee', padding: '15px' }}>
         <p><strong>ID:</strong> {atm.id}</p>
         <p><strong>UID:</strong> {atm.atm_uid}</p>
         <p><strong>Местоположение:</strong> {atm.location_description || 'Не указано'}</p>
         <p><strong>IP Адрес:</strong> {atm.ip_address || 'Не указан'}</p>
         <p><strong>Статус:</strong> {atm.status?.name || 'Неизвестно'} (ID: {atm.status_id})</p>
         <p><strong>Кем добавлен (User ID):</strong> {atm.added_by_user_id || 'Неизвестно'}</p>
         <p><strong>Дата создания:</strong> {new Date(atm.created_at).toLocaleString()}</p>
         <p><strong>Дата обновления:</strong> {new Date(atm.updated_at).toLocaleString()}</p>
      </div>

      <div style={{marginTop: '20px'}}>
          <Link to={`/atms/${atm.id}/logs`}>Посмотреть логи этого банкомата</Link>
      </div>
    </div>
  );
};

export default ATMDetailPage;