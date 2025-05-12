// src/types.ts
export interface ATMLog {
    id: number;
    atm_id: number;
    event_timestamp: string; // Дата как строка
    log_level_id: number;
    event_type_id?: number | null;
    message: string;
    payload?: Record<string, any> | null; // JSONB как объект JS { ключ: значение }
    is_alert: boolean;
    acknowledged_by_user_id?: number | null;
    acknowledged_at?: string | null; // Дата как строка
    recorded_at: string; // Дата как строка

    // Вложенные объекты для удобного отображения
    log_level: LogLevel;
    event_type?: EventType | null; // Может быть null
    // Можно добавить atm: ATM;, если API его возвращает
}
export interface LogLevel {
    id: number;
    name: string;
    severity_order?: number | null;
}
export interface ATMCreatePayload {
  atm_uid: string;
  location_description?: string | null; // Сделаем опциональными или null
  ip_address?: string | null;           // Сделаем опциональными или null
  status_id: number;
}

// Тип события лога (добавлено)
export interface EventType {
    id: number;
    name: string;
    category?: string | null;
    description?: string | null;
}
export interface ATMStatus {
    id: number;
    name: string;
    description?: string | null;
  }
export interface ATM {
    id: number;
    atm_uid: string;
    location_description?: string | null;
    ip_address?: string | null;
    status_id: number;
    added_by_user_id?: number | null;
    created_at: string; 
    updated_at: string;
    status: ATMStatus; 
}
export interface User {
    id: number;
    username: string;
    email: string;
    role: 'operator' | 'admin' | 'superadmin';
    created_at: string;
    updated_at: string;
}