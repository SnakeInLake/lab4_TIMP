// src/pages/ATMsPage.tsx
import React, { useState, useEffect, useMemo, useCallback } from 'react'; 
import { Link } from 'react-router-dom';
import apiClient from '../services/api';
import type { ATM, ATMStatus } from '../src/types'; 
import './ATMsPage.css'; // Используем общий стиль

// Тип для ключей, по которым можно сортировать 
type SortableATMKeys = keyof Pick<ATM, 'id' | 'atm_uid' | 'created_at'> | 'status.name' | 'location_description';
type SortOrder = 'asc' | 'desc';

const ATMsPage: React.FC = () => {
  const [atms, setAtms] = useState<ATM[]>([]); // Данные с сервера (текущая страница)
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // --- Пагинация ---
  const [currentPage, setCurrentPage] = useState(1); 
  const [itemsPerPage, setItemsPerPage] = useState(10); 
  const [totalItems, setTotalItems] = useState(0); 

  // --- Фильтрация ---
  const [appliedFilters, setAppliedFilters] = useState<{ // Фильтры, которые реально отправляются на бэк
    status_id?: number | string; 
    location?: string; // Фильтр по местоположению (ключевое слово)
    atm_uid?: string; // Фильтр по UID (ключевое слово)
  }>({}); 
  // Временные значения в полях ввода для текстовых фильтров
  const [locationInput, setLocationInput] = useState('');
  const [uidInput, setUidInput] = useState('');
  // Значение для select'а статуса (применяется сразу)
  const [statusInput, setStatusInput] = useState<string>(''); 
  const [statuses, setStatuses] = useState<ATMStatus[]>([]);

  // --- Клиентская Сортировка ---
  const [sortKey, setSortKey] = useState<SortableATMKeys>('id'); 
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc');

  // --- Функция загрузки данных (пагинация и фильтрация с сервера) ---
  const fetchAtms = useCallback(async () => {
    setLoading(true);
    setError(null);
    const skip = (currentPage - 1) * itemsPerPage;
    
    // Используем appliedFilters для формирования параметров запроса
    const params = { 
      skip: skip,
      limit: itemsPerPage,
      status_id: appliedFilters.status_id || undefined, 
      location: appliedFilters.location || undefined, // Отправляем ключевое слово для поиска
      atm_uid: appliedFilters.atm_uid || undefined,  // Отправляем ключевое слово для поиска
      // sort_by: sortParams.sortBy, // Серверная сортировка пока не реализована на бэке
      // sort_order: sortParams.sortOrder,
    };

    try {
      const response = await apiClient.get<ATM[]>('/atms/', { params });
      setAtms(response.data); 
      
      const totalCountHeader = response.headers['x-total-count'];
      if (totalCountHeader) {
        setTotalItems(parseInt(totalCountHeader, 10));
      } else {
        console.warn("X-Total-Count header not found");
        const estimatedTotal = skip + response.data.length;
        setTotalItems(response.data.length === itemsPerPage ? estimatedTotal + 1 : estimatedTotal);
      }

    } catch (err: any) {
      console.error("Failed to fetch ATMs:", err);
      setError(err.response?.data?.detail || err.message || 'Не удалось загрузить список банкоматов.');
      setAtms([]); 
      setTotalItems(0);
    } finally {
      setLoading(false);
    }
  }, [currentPage, itemsPerPage, appliedFilters /*, sortParams*/]); // Зависим от примененных фильтров

  // --- Функция загрузки статусов ---
  const fetchStatuses = useCallback(async () => { 
      try {
         const response = await apiClient.get<ATMStatus[]>('/atms/statuses/');
         setStatuses(response.data);
      } catch(err) {
          console.error("Failed to fetch statuses:", err);
          setError(prev => prev ? `${prev}; Не удалось загрузить статусы` : 'Не удалось загрузить статусы');
      }
  }, []);

  // --- Загрузка данных ---
  useEffect(() => {
    fetchAtms();
  }, [fetchAtms]); 

   useEffect(() => {
    fetchStatuses(); 
  }, [fetchStatuses]); 

  // --- Обработчики UI Фильтрации ---
  // Обновляем временные значения в инпутах при вводе
  const handleLocationInputChange = (e: React.ChangeEvent<HTMLInputElement>) => setLocationInput(e.target.value);
  const handleUidInputChange = (e: React.ChangeEvent<HTMLInputElement>) => setUidInput(e.target.value);

  // Фильтр по статусу применяется сразу
  const handleStatusChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value;
    setStatusInput(value);
    setAppliedFilters(prev => ({ ...prev, status_id: value === "" ? undefined : Number(value) || undefined })); // Преобразуем в число или undefined
    setCurrentPage(1); 
  };

  // Функция применения текстовых фильтров (вызывается по Enter или кнопке)
  const applyTextFilters = () => {
     setAppliedFilters(prev => ({
            ...prev,
            location: locationInput.trim() === '' ? undefined : locationInput.trim(), // Убираем пробелы
            atm_uid: uidInput.trim() === '' ? undefined : uidInput.trim() // Убираем пробелы
        }));
        setCurrentPage(1); // Сброс на первую страницу при применении фильтров
  }

  // Обработчик нажатия Enter для полей ввода location и atm_uid
  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
        applyTextFilters(); // Вызываем функцию применения фильтров
    }
  };
  
  // Обработчик кнопки "Сбросить фильтры"
  const resetFilters = () => {
      // Сбрасываем примененные фильтры
      setAppliedFilters(prev => ({
          ...prev, // Оставляем другие фильтры, если они есть (например, статус)
          location: undefined, 
          atm_uid: undefined 
      })); 
      // Очищаем поля ввода
      setLocationInput('');
      setUidInput('');
      // Опционально: сбрасываем и статус
      // setStatusInput('');
      // setAppliedFilters({}); // Полный сброс
      
      setCurrentPage(1);
  };

  // --- Обработчик смены страницы пагинации ---
  const handlePageChange = (newPage: number) => {
    setCurrentPage(newPage);
  };

  // --- Обработчик Клиентской Сортировки ---
  const handleSort = (key: SortableATMKeys) => {
    setSortOrder(prevOrder => (sortKey === key && prevOrder === 'asc') ? 'desc' : 'asc');
    setSortKey(key);
  };

  // --- Мемоизированный отсортированный список (клиентская сортировка) ---
  const sortedAtms = useMemo(() => {
    const pageDataToSort = [...atms]; 
    pageDataToSort.sort((a, b) => {
      const getValue = (obj: ATM, key: SortableATMKeys) => {
        if (key === 'status.name') return obj.status?.name?.toLowerCase() || '';
        if (key === 'location_description') return obj.location_description?.toLowerCase() || '';
        const directKey = key as keyof ATM; 
        if (directKey in obj) {
            const val = obj[directKey];
            return typeof val === 'string' ? val.toLowerCase() : val;
        }
        return null; 
      };
      const valA = getValue(a, sortKey);
      const valB = getValue(b, sortKey);
      if (valA === null || valA === undefined) return sortOrder === 'asc' ? 1 : -1;
      if (valB === null || valB === undefined) return sortOrder === 'asc' ? -1 : 1;
      let comparison = 0;
      if (valA > valB) comparison = 1;
      else if (valA < valB) comparison = -1;
      return sortOrder === 'desc' ? comparison * -1 : comparison;
    });
    return pageDataToSort;
  }, [atms, sortKey, sortOrder]); 

  // --- Расчет пагинации ---
  const totalPages = totalItems > 0 ? Math.ceil(totalItems / itemsPerPage) : 1;

  // --- Функция рендера стрелок сортировки ---
  const renderSortArrow = (key: SortableATMKeys) => {
    if (sortKey === key) { return sortOrder === 'asc' ? ' ▲' : ' ▼'; }
    return '';
  };

  // --- Рендер Компонента ---
  // ... (Код рендера остается почти таким же, как в предыдущем ответе) ...
  // Используем sortedAtms для рендера таблицы
  // Используем обработчики handleSort для заголовков
  // Используем обработчики фильтров для полей ввода и select
  // Используем обработчики пагинации для кнопок и select'а страниц
  return (
    <div>
      <h2>Список Банкоматов</h2>

      <div className="filter-block">
        <div className="filter-group">
          <label htmlFor="locationFilter">Местоположение (Enter):</label>
          <input type="text" id="locationFilter" value={locationInput} onChange={handleLocationInputChange} onKeyDown={handleInputKeyDown} placeholder="Ключевое слово..." />
        </div>
         <div className="filter-group">
          <label htmlFor="uidFilter">UID Банкомата (Enter):</label>
          <input type="text" id="uidFilter" value={uidInput} onChange={handleUidInputChange} onKeyDown={handleInputKeyDown} placeholder="UID..." />
        </div>
        <div className="filter-group">
            <label htmlFor="statusFilter">Статус:</label>
            <select id="statusFilter" value={statusInput} onChange={handleStatusChange}>
                <option value="">Все статусы</option>
                {statuses.map(status => (<option key={status.id} value={status.id}>{status.name}</option>))}
            </select>
        </div>
        <div className="filter-group buttons">
            {/* Убрали кнопку "Применить", т.к. работает Enter */}
            <button onClick={resetFilters} className="button-small secondary">Сбросить текст</button> 
        </div>
      </div>
       {error && <div style={{ color: 'red', marginBottom: '10px' }}>{error}</div>}
       {loading && <div className="loading-overlay">Загрузка...</div>}

      <table className="data-table">
         <thead>
            <tr>
              <th onClick={() => handleSort('id')} style={{cursor: 'pointer'}}>ID{renderSortArrow('id')}</th>
              <th onClick={() => handleSort('atm_uid')} style={{cursor: 'pointer'}}>UID{renderSortArrow('atm_uid')}</th>
              <th onClick={() => handleSort('location_description')} style={{cursor: 'pointer'}}>Местоположение{renderSortArrow('location_description')}</th>
              <th onClick={() => handleSort('status.name')} style={{cursor: 'pointer'}}>Статус{renderSortArrow('status.name')}</th>
              <th onClick={() => handleSort('created_at')} style={{cursor: 'pointer'}}>Добавлен{renderSortArrow('created_at')}</th>
              <th>Действия</th>
            </tr>
          </thead>
        <tbody>
          {sortedAtms.length === 0 && !loading ? ( 
              <tr><td colSpan={6}>Банкоматы не найдены.</td></tr> 
          ) : (
            sortedAtms.map((atm) => ( 
            <tr key={atm.id}>
              <td>{atm.id}</td>
              <td>{atm.atm_uid}</td>
              <td>{atm.location_description || '-'}</td>
              <td>{atm.status?.name ?? `ID: ${atm.status_id}`}</td> 
              <td>{new Date(atm.created_at).toLocaleString()}</td>
              <td>
                <Link to={`/atms/${atm.id}`} style={{ marginRight: '5px' }}>Детали</Link>
                <Link to={`/atms/${atm.id}/logs`}>Логи</Link>
              </td>
            </tr>
            ))
          )}
        </tbody>
      </table>

        <div className="pagination-controls"> 
            <button onClick={() => handlePageChange(currentPage - 1)} disabled={currentPage <= 1}> Назад </button>
            <span>Страница {currentPage} из {totalPages} (Всего: {totalItems})</span> 
            <button onClick={() => handlePageChange(currentPage + 1)} disabled={currentPage >= totalPages}> Вперед </button>
            <select value={itemsPerPage} onChange={(e) => { setItemsPerPage(Number(e.target.value)); setCurrentPage(1); }} style={{marginLeft: '20px'}}>
                <option value={5}>5</option>
                <option value={10}>10</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
            </select>
            <span style={{marginLeft: '5px'}}>на стр.</span>
        </div>
    </div>
  );
};

export default ATMsPage;