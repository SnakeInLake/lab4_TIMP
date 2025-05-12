// src/pages/ATMLogsPage.tsx
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import apiClient from '../services/api';
import type { ATMLog, LogLevel, EventType } from '../src/types'; // Убедитесь, что путь правильный
import './ATMsPage.css'; // Используем общий стиль

// Типы для параметров фильтрации логов
interface LogFilters {
  log_level_id?: number | string;
  event_type_id?: number | string;
  is_alert?: boolean | string;
  start_time?: string;
  end_time?: string;
  message?: string;
}

// Тип для ключей, по которым можно сортировать логи (аналогично SortableATMKeys)
type SortableLogKeys = keyof Pick<ATMLog, 'id' | 'event_timestamp' | 'recorded_at'> | 'log_level.name' | 'event_type.name';
type SortOrder = 'asc' | 'desc';

const ATMLogsPage: React.FC = () => {
  const { id: atmIdParam } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [logs, setLogs] = useState<ATMLog[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [atmUid, setAtmUid] = useState<string>('');
  const [actionLoading, setActionLoading] = useState<number | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  // --- Пагинация ---
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(15);
  const [totalItems, setTotalItems] = useState(0);

  // --- Фильтрация ---
  const [appliedFilters, setAppliedFilters] = useState<LogFilters>({});
  const [logLevelInput, setLogLevelInput] = useState<string>('');
  const [eventTypeIdInput, setEventTypeIdInput] = useState<string>('');
  const [isAlertInput, setIsAlertInput] = useState<string>(''); // '', 'true', 'false'
  const [startTimeInput, setStartTimeInput] = useState<string>('');
  const [endTimeInput, setEndTimeInput] = useState<string>('');
  const [messageInput, setMessageInput] = useState<string>('');
  const [logLevels, setLogLevels] = useState<LogLevel[]>([]);
  const [eventTypes, setEventTypes] = useState<EventType[]>([]);

  // --- Клиентская Сортировка ---
  const [sortKey, setSortKey] = useState<SortableLogKeys>('event_timestamp');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');

  // --- Функция загрузки логов ---
  const fetchLogs = useCallback(async (currentAtmId: string | number) => {
    setLoading(true);
    setError(null);
    const skip = (currentPage - 1) * itemsPerPage;

    const params = {
      skip: skip,
      limit: itemsPerPage,
      atm_id: currentAtmId,
      log_level_id: appliedFilters.log_level_id || undefined,
      event_type_id: appliedFilters.event_type_id || undefined,
      is_alert: appliedFilters.is_alert === 'true' ? true : appliedFilters.is_alert === 'false' ? false : undefined,
      start_time: appliedFilters.start_time || undefined,
      end_time: appliedFilters.end_time || undefined,
      message: appliedFilters.message || undefined,
      // Сортировка будет клиентской, поэтому не передаем на бэк
      // sort_by: sortKey,
      // sort_order: sortOrder,
    };

    try {
      const [logsResponse, atmResponse] = await Promise.all([
        apiClient.get<{ data: ATMLog[], total: number }>('/logs/', { params }), // Предполагаем, что API возвращает total
        apiClient.get(`/atms/${currentAtmId}`)
      ]);
      
      // Используем структуру ответа, если она { data: [], total: N }
      // Если API возвращает массив и X-Total-Count, логика будет другой
      if (logsResponse.data && typeof logsResponse.data.total === 'number') {
          setLogs(logsResponse.data.data);
          setTotalItems(logsResponse.data.total);
      } else { // Обработка X-Total-Count, если API не возвращает total в теле
          // @ts-ignore - logsResponse.data здесь это ATMLog[]
          setLogs(logsResponse.data); 
          const totalCountHeader = logsResponse.headers['x-total-count'];
          if (totalCountHeader) {
              setTotalItems(parseInt(totalCountHeader, 10));
          } else {
              console.warn("X-Total-Count header not found for logs, and 'total' not in response body. Estimating total.");
              // @ts-ignore
              const estimatedTotal = skip + logsResponse.data.length;
              // @ts-ignore
              setTotalItems(logsResponse.data.length === itemsPerPage ? estimatedTotal + 1 : estimatedTotal);
          }
      }
      setAtmUid(atmResponse.data.atm_uid);

    } catch (err: any) {
      console.error(`Failed to fetch data for ATM ${currentAtmId}:`, err);
      if (err.response?.status === 404 && err.config.url?.includes('/logs/')) {
        setLogs([]);
        setTotalItems(0);
        setError(null);
        try {
          const atmRes = await apiClient.get(`/atms/${currentAtmId}`);
          setAtmUid(atmRes.data.atm_uid);
        } catch { /* Ошибка получения ATM обработается ниже */ }
      } else if (err.response?.status === 404) {
        setError(`Банкомат с ID ${currentAtmId} не найден.`);
        setLogs([]);
        setTotalItems(0);
      } else {
        setError(err.response?.data?.detail || err.message || 'Не удалось загрузить данные.');
        setLogs([]);
        setTotalItems(0);
      }
    } finally {
      setLoading(false);
    }
  }, [currentPage, itemsPerPage, appliedFilters]); // Зависим от примененных фильтров, убрали sortKey, sortOrder

  // --- Функции загрузки справочников ---
  const fetchLogDataOptions = useCallback(async () => {
    try {
      const [levelsRes, typesRes] = await Promise.all([
        apiClient.get<LogLevel[]>('/logs/levels/'),
        apiClient.get<EventType[]>('/logs/event_types/')
      ]);
      setLogLevels(levelsRes.data);
      setEventTypes(typesRes.data);
    } catch (err) {
      console.error("Failed to fetch log options:", err);
      setError(prev => prev ? `${prev}; Не удалось загрузить справочники логов` : 'Не удалось загрузить справочники логов');
    }
  }, []);

  // --- Загрузка данных ---
  useEffect(() => {
    const atmIdNumber = parseInt(atmIdParam || '', 10);
    if (!atmIdParam || isNaN(atmIdNumber)) {
      setError("Некорректный ID банкомата в URL.");
      setLoading(false);
      return;
    }
    fetchLogs(atmIdNumber);
  }, [atmIdParam, fetchLogs]);

  useEffect(() => {
    fetchLogDataOptions();
  }, [fetchLogDataOptions]);

  // --- Обработчики UI Фильтрации ---
  const handleMessageInputChange = (e: React.ChangeEvent<HTMLInputElement>) => setMessageInput(e.target.value);
  const handleStartTimeChange = (e: React.ChangeEvent<HTMLInputElement>) => setStartTimeInput(e.target.value);
  const handleEndTimeChange = (e: React.ChangeEvent<HTMLInputElement>) => setEndTimeInput(e.target.value);

  const handleLevelChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value;
    setLogLevelInput(value);
    setAppliedFilters(prev => ({ ...prev, log_level_id: value === "" ? undefined : Number(value) }));
    setCurrentPage(1);
  };
  const handleEventTypeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value;
    setEventTypeIdInput(value);
    setAppliedFilters(prev => ({ ...prev, event_type_id: value === "" ? undefined : Number(value) }));
    setCurrentPage(1);
  };
  const handleAlertStatusChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value;
    setIsAlertInput(value);
    setAppliedFilters(prev => ({ ...prev, is_alert: value === "" ? undefined : value }));
    setCurrentPage(1);
  };

  const applyTextAndDateFilters = () => {
    setAppliedFilters(prev => ({
      ...prev,
      message: messageInput.trim() === '' ? undefined : messageInput.trim(),
      start_time: startTimeInput || undefined,
      end_time: endTimeInput || undefined,
    }));
    setCurrentPage(1);
  }

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      applyTextAndDateFilters();
    }
  };

  const resetFilters = () => {
    setAppliedFilters({});
    setMessageInput('');
    setStartTimeInput('');
    setEndTimeInput('');
    setLogLevelInput('');
    setEventTypeIdInput('');
    setIsAlertInput('');
    setCurrentPage(1);
  };

  // --- Пагинация ---
  const handlePageChange = (newPage: number) => setCurrentPage(newPage);

  // --- Клиентская Сортировка ---
  const handleSort = (key: SortableLogKeys) => {
    setSortOrder(prevOrder => (sortKey === key && prevOrder === 'asc') ? 'desc' : 'asc');
    setSortKey(key);
  };

  // --- Мемоизированный отсортированный список (клиентская сортировка) ---
  const sortedLogs = useMemo(() => {
    const pageDataToSort = [...logs];
    pageDataToSort.sort((a, b) => {
      const getValue = (obj: ATMLog, key: SortableLogKeys) => {
        if (key === 'log_level.name') return obj.log_level?.name?.toLowerCase() || '';
        if (key === 'event_type.name') return obj.event_type?.name?.toLowerCase() || '';
        // Для 'id', 'event_timestamp', 'recorded_at'
        const directKey = key as keyof Pick<ATMLog, 'id' | 'event_timestamp' | 'recorded_at'>;
        if (directKey in obj) {
          const val = obj[directKey];
          if (key === 'event_timestamp' || key === 'recorded_at') return new Date(val as string);
          return typeof val === 'string' ? val.toLowerCase() : val;
        }
        return null;
      };
      const valA = getValue(a, sortKey);
      const valB = getValue(b, sortKey);

      if (valA === null || valA === undefined) return sortOrder === 'asc' ? 1 : -1;
      if (valB === null || valB === undefined) return sortOrder === 'asc' ? -1 : 1;

      let comparison = 0;
      if (valA instanceof Date && valB instanceof Date) {
        comparison = valA.getTime() - valB.getTime();
      } else if (typeof valA === 'number' && typeof valB === 'number') {
        comparison = valA - valB;
      } else if (typeof valA === 'string' && typeof valB === 'string') {
        comparison = valA.localeCompare(valB);
      } else { // fallback for mixed types or other types
        if (valA > valB) comparison = 1;
        else if (valA < valB) comparison = -1;
      }
      return sortOrder === 'desc' ? comparison * -1 : comparison;
    });
    return pageDataToSort;
  }, [logs, sortKey, sortOrder]);

  // --- Расчет пагинации ---
  const totalPages = totalItems > 0 ? Math.ceil(totalItems / itemsPerPage) : 1;

  // --- Функция рендера стрелок ---
  const renderSortArrow = (key: SortableLogKeys) => {
    if (sortKey === key) { return sortOrder === 'asc' ? ' ▲' : ' ▼'; }
    return '';
  };

  // --- Функция подтверждения алерта ---
  const handleAcknowledge = async (logId: number) => {
    setActionLoading(logId);
    setActionError(null);
    try {
        // Предполагается, что у вас есть эндпоинт для подтверждения
        await apiClient.post(`/logs/${logId}/acknowledge/`); 
        // Обновляем только измененный лог или перезапрашиваем все
        setLogs(prevLogs => 
            prevLogs.map(log => 
                log.id === logId 
                ? { ...log, acknowledged_by_user_id: 1, acknowledged_at: new Date().toISOString() } // Заглушка для user_id
                : log
            )
        );
        // Или, если нужно точное значение acknowledged_by_user_id и acknowledged_at с бэка:
        // fetchLogs(atmIdParam!); 
    } catch (err: any) {
        console.error("Failed to acknowledge log:", err);
        setActionError(err.response?.data?.detail || err.message || "Не удалось подтвердить алерт.");
    } finally {
        setActionLoading(null);
    }
  };

  if (!atmIdParam) { // Добавим проверку, чтобы useParams точно вернул ID
    return <div>Не указан ID банкомата.</div>;
  }
  
  // --- Рендер ---
  return (
    <div>
      <h2>Логи Банкомата: {atmUid || 'Загрузка...'} (ID: {atmIdParam})</h2>
      <button onClick={() => navigate(-1)} style={{ marginRight: '10px' }}>Назад</button>
      <button onClick={() => navigate(`/atms/${atmIdParam}`)}>К деталям ATM</button>


      <div className="filter-block">
        <div className="filter-group">
          <label htmlFor="messageFilter">Сообщение (Enter):</label>
          <input type="text" id="messageFilter" value={messageInput} onChange={handleMessageInputChange} onKeyDown={handleInputKeyDown} placeholder="Ключевое слово..." />
        </div>
        <div className="filter-group">
          <label htmlFor="levelFilter">Уровень:</label>
          <select id="levelFilter" value={logLevelInput} onChange={handleLevelChange}>
            <option value="">Все</option>
            {logLevels.map(level => (<option key={level.id} value={level.id}>{level.name}</option>))}
          </select>
        </div>
        <div className="filter-group">
          <label htmlFor="eventTypeFilter">Тип события:</label>
          <select id="eventTypeFilter" value={eventTypeIdInput} onChange={handleEventTypeChange}>
            <option value="">Все</option>
            {eventTypes.map(type => (<option key={type.id} value={type.id}>{type.name}</option>))}
          </select>
        </div>
        <div className="filter-group">
          <label htmlFor="alertFilter">Алерт:</label>
          <select id="alertFilter" value={isAlertInput} onChange={handleAlertStatusChange}>
            <option value="">Все</option>
            <option value="true">Да</option>
            <option value="false">Нет</option>
          </select>
        </div>
        <div className="filter-group">
          <label htmlFor="startTimeFilter">С (YYYY-MM-DDTHH:MM):</label>
          <input type="datetime-local" id="startTimeFilter" value={startTimeInput} onChange={handleStartTimeChange} onKeyDown={handleInputKeyDown} />
        </div>
        <div className="filter-group">
          <label htmlFor="endTimeFilter">По (YYYY-MM-DDTHH:MM):</label>
          <input type="datetime-local" id="endTimeFilter" value={endTimeInput} onChange={handleEndTimeChange} onKeyDown={handleInputKeyDown} />
        </div>
        <div className="filter-group buttons">
          <button onClick={applyTextAndDateFilters} className="button-small">Применить даты/текст</button>
          <button onClick={resetFilters} className="button-small secondary">Сбросить все</button>
        </div>
      </div>

      {actionError && <p style={{ color: 'red', marginTop: '10px' }}>Ошибка действия: {actionError}</p>}
      {error && <div style={{ color: 'red', marginBottom: '10px' }}>{error}</div>}
      {loading && <div className="loading-overlay">Загрузка...</div>}

      <table className="data-table">
        <thead>
          <tr>
            <th onClick={() => handleSort('id')} style={{ cursor: 'pointer' }}>ID{renderSortArrow('id')}</th>
            <th onClick={() => handleSort('event_timestamp')} style={{ cursor: 'pointer' }}>Время{renderSortArrow('event_timestamp')}</th>
            <th onClick={() => handleSort('log_level.name')} style={{ cursor: 'pointer' }}>Уровень{renderSortArrow('log_level.name')}</th>
            <th onClick={() => handleSort('event_type.name')} style={{ cursor: 'pointer' }}>Тип{renderSortArrow('event_type.name')}</th>
            <th>Сообщение</th>
            <th>Алерт</th>
            <th>Подтвержден</th>
            <th>Действия</th>
          </tr>
        </thead>
        <tbody>
          {sortedLogs.length === 0 && !loading ? (
            <tr><td colSpan={8}>Записи логов не найдены.</td></tr>
          ) : (
            sortedLogs.map((log) => (
              <tr key={log.id}>
                <td>{log.id}</td>
                <td>{new Date(log.event_timestamp).toLocaleString()}</td>
                <td style={{
                  fontWeight: log.log_level?.name === 'ERROR' || log.log_level?.name === 'CRITICAL' ? 'bold' : 'normal',
                  color: log.log_level?.name === 'ERROR' ? 'var(--log-level-error)' : log.log_level?.name === 'CRITICAL' ? 'var(--log-level-critical)' : 'inherit'
                }}>
                  {log.log_level?.name || log.log_level_id}
                </td>
                <td>{log.event_type?.name || log.event_type_id || '-'}</td>
                <td>{log.message}</td>
                <td style={{ color: log.is_alert ? 'var(--alert-yes-text)' : 'inherit', fontWeight: log.is_alert ? 'bold' : 'normal' }}>
                  {log.is_alert ? 'ДА' : 'Нет'}
                </td>
                <td>{log.acknowledged_by_user_id ?? '-'} {log.acknowledged_at ? `(${new Date(log.acknowledged_at).toLocaleTimeString()})` : ''}</td>
                <td>
                  {log.is_alert && !log.acknowledged_by_user_id && (
                    <button onClick={() => handleAcknowledge(log.id)} disabled={actionLoading === log.id} className="button-small">
                      {actionLoading === log.id ? '...' : 'Ознакомлен'}
                    </button>
                  )}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>

      {totalItems > 0 && (
        <div className="pagination-controls">
          <button onClick={() => handlePageChange(currentPage - 1)} disabled={currentPage <= 1}> Назад </button>
          <span>Страница {currentPage} из {totalPages} (Всего: {totalItems})</span>
          <button onClick={() => handlePageChange(currentPage + 1)} disabled={currentPage >= totalPages}> Вперед </button>
          <select value={itemsPerPage} onChange={(e) => { setItemsPerPage(Number(e.target.value)); setCurrentPage(1); }} style={{ marginLeft: '20px' }}>
            <option value={5}>5</option>
            <option value={10}>10</option>
            <option value={15}>15</option>
            <option value={25}>25</option>
            <option value={50}>50</option>
          </select>
          <span style={{ marginLeft: '5px' }}>на стр.</span>
        </div>
      )}
    </div>
  );
};

export default ATMLogsPage;