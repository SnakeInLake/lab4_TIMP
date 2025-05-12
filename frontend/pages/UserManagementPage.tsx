// src/pages/UserManagementPage.tsx
import React, { useState, useEffect, useMemo, useCallback } from 'react'; // Добавили useCallback
import apiClient from '../services/api';
import type { User } from '../src/types';

interface UserManagementPageProps {
    currentUser: User | null;
}

type SortableUserKeys = keyof Pick<User, 'id' | 'username' | 'email' | 'role' | 'created_at'>;
type SortOrder = 'asc' | 'desc';

const UserManagementPage: React.FC<UserManagementPageProps> = ({ currentUser }) => {
    const [users, setUsers] = useState<User[]>([]);
    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);

    const [sortKey, setSortKey] = useState<SortableUserKeys>('id');
    const [sortOrder, setSortOrder] = useState<SortOrder>('asc');

    // Используем useCallback для fetchUsers, чтобы избежать лишних вызовов, если она передается в зависимости
    const fetchUsers = useCallback(async () => {
        if (!currentUser || (currentUser.role !== 'admin' && currentUser.role !== 'superadmin')) {
            // Проверка прав уже есть, но дублируем для надежности перед запросом
            setError('Доступ запрещен или пользователь не авторизован для загрузки списка.');
            setLoading(false);
            return;
        }
        setLoading(true);
        setError(null);
        try {
            const response = await apiClient.get<User[]>('/users/');
            setUsers(response.data);
        } catch (err: any) {
            console.error("Failed to fetch users:", err);
            let errorMessage = err.response?.data?.detail || err.message || 'Не удалось загрузить список пользователей.';
            if (err.response?.status === 403) {
                errorMessage = 'У вас нет прав для просмотра списка пользователей (API).';
            }
            setError(errorMessage);
        } finally {
            setLoading(false);
        }
    }, [currentUser]); // Зависимость от currentUser

    useEffect(() => {
        console.log("UserManagementPage - currentUser from props:", currentUser);

        if (!currentUser) {
            setError("Информация о текущем пользователе недоступна.");
            setLoading(false);
            return;
        }

        if (currentUser.role !== 'admin' && currentUser.role !== 'superadmin') {
            setError('Доступ к этой странице запрещен.');
            setLoading(false);
            return;
        }
        fetchUsers();
    }, [currentUser, fetchUsers]); // Добавили fetchUsers в зависимости


    const handleSort = (key: SortableUserKeys) => {
        if (sortKey === key) {
            setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
        } else {
            setSortKey(key);
            setSortOrder('asc');
        }
    };

    const sortedUsers = useMemo(() => {
        if (!users) return [];
        const newSortedUsers = [...users];
        newSortedUsers.sort((a, b) => {
            const valA = typeof a[sortKey] === 'string' ? (a[sortKey] as string).toLowerCase() : a[sortKey];
            const valB = typeof b[sortKey] === 'string' ? (b[sortKey] as string).toLowerCase() : b[sortKey];
            let comparison = 0;
            if (valA > valB) comparison = 1;
            else if (valA < valB) comparison = -1;
            return sortOrder === 'desc' ? comparison * -1 : comparison;
        });
        return newSortedUsers;
    }, [users, sortKey, sortOrder]);

    const handleRoleChange = async (userId: number, newRole: 'operator' | 'admin' /* убрали 'superadmin' для безопасности */) => {
        if (!currentUser) {
            alert("Ошибка: Текущий пользователь не определен.");
            return;
        }
        if (currentUser.id === userId && currentUser.role === 'superadmin') {

    alert("Суперадмин не может понизить свою роль.");
    return;
}
        const targetUser = users.find(u => u.id === userId);
        if (currentUser.role === 'admin' && targetUser && (targetUser.role === 'admin' || targetUser.role === 'superadmin')) {
            alert("Администратор не может изменять роли других администраторов или суперадминистраторов.");
            return;
        }
        if (newRole === 'admin' && currentUser.role !== 'superadmin') {
             // Убрали newRole === 'superadmin', так как назначение суперадмина - редкая операция, лучше через БД
            alert("Только суперадмин может назначать роль администратора.");
            return;
        }

        const originalUsers = [...users];
        setUsers(currentUsers => currentUsers.map(u => u.id === userId ? { ...u, role: newRole } : u));

        try {
            await apiClient.put(`/users/${userId}/role`, { role: newRole });
            alert(`Роль пользователя ID ${userId} успешно изменена на ${newRole}.`);
            // fetchUsers(); // Можно перезагрузить для полной синхронизации
        } catch (err: any) {
            console.error(`Failed to update role for user ${userId}:`, err);
            setError(err.response?.data?.detail || err.message || 'Не удалось изменить роль пользователя.');
            setUsers(originalUsers);
        }
    };

    // НОВАЯ ФУНКЦИЯ: Обработчик удаления пользователя
    const handleDeleteUser = async (userId: number, username: string) => {
        if (!currentUser || currentUser.role !== 'superadmin') {
            alert("Только суперадминистратор может удалять пользователей.");
            return;
        }
        if (currentUser.id === userId) {
            alert("Суперадминистратор не может удалить сам себя через этот интерфейс.");
            return;
        }

        // Проверка на последнего суперадмина (на клиенте, но основная проверка на бэке)
        const targetUser = users.find(u => u.id === userId);
        if (targetUser && targetUser.role === 'superadmin') {
            const superadminCount = users.filter(u => u.role === 'superadmin').length;
            if (superadminCount <= 1) {
                alert("Нельзя удалить единственного суперадминистратора в системе.");
                return;
            }
        }

        if (window.confirm(`Вы уверены, что хотите удалить пользователя ${username} (ID: ${userId})? Это действие необратимо.`)) {
            setLoading(true); // Можно добавить индикатор загрузки для операции удаления
            try {
                await apiClient.delete(`/users/${userId}`);
                alert(`Пользователь ${username} (ID: ${userId}) успешно удален.`);
                // Обновляем список пользователей после удаления
                setUsers(currentUsers => currentUsers.filter(user => user.id !== userId));
                // или fetchUsers(); для полной синхронизации, если нужно
            } catch (err: any) {
                console.error(`Failed to delete user ${userId}:`, err);
                const errorMessage = err.response?.data?.detail || err.message || 'Не удалось удалить пользователя.';
                setError(errorMessage); // Отображаем ошибку
                alert(`Ошибка: ${errorMessage}`); // И выводим alert
            } finally {
                setLoading(false);
            }
        }
    };


    const renderSortArrow = (key: SortableUserKeys) => {
        if (sortKey === key) {
            return sortOrder === 'asc' ? ' ▲' : ' ▼';
        }
        return '';
    };

    if (loading && users.length === 0) return <div>Загрузка пользователей...</div>;
    if (error && users.length === 0) return <div style={{ color: 'red' }}>Ошибка: {error}</div>; // Показываем ошибку, только если список пуст
    if (!currentUser || (currentUser.role !== 'admin' && currentUser.role !== 'superadmin')) {
        return <div style={{ color: 'red' }}>Доступ запрещен или пользователь не авторизован.</div>;
    }

    return (
        <div>
            <h2>Управление Пользователями</h2>
            {/* Отображаем глобальную ошибку, если она есть и список не пуст (ошибка при операции) */}
            {error && users.length > 0 && <p style={{ color: 'red' }}>Ошибка операции: {error}</p>}
            {loading && <p>Обновление...</p>}
            {sortedUsers.length === 0 && !loading ? (
                <p>Пользователи не найдены.</p>
            ) : (
                <table className="atmTable">
                    <thead>
                        <tr>
                            <th onClick={() => handleSort('id')} style={{ cursor: 'pointer' }}>
                                ID{renderSortArrow('id')}
                            </th>
                            <th onClick={() => handleSort('username')} style={{ cursor: 'pointer' }}>
                                Имя пользователя{renderSortArrow('username')}
                            </th>
                            <th onClick={() => handleSort('email')} style={{ cursor: 'pointer' }}>
                                Email{renderSortArrow('email')}
                            </th>
                            <th onClick={() => handleSort('role')} style={{ cursor: 'pointer' }}>
                                Роль{renderSortArrow('role')}
                            </th>
                            <th onClick={() => handleSort('created_at')} style={{ cursor: 'pointer' }}>
                                Дата создания{renderSortArrow('created_at')}
                            </th>
                            <th>Действия</th> {/* Изменили заголовок */}
                        </tr>
                    </thead>
                    <tbody>
                        {sortedUsers.map((user) => (
                            <tr key={user.id}>
                                <td>{user.id}</td>
                                <td>{user.username}</td>
                                <td>{user.email}</td>
                                <td>{user.role}</td>
                                <td>{new Date(user.created_at).toLocaleString()}</td>
                                <td>
                                    {/* Кнопки смены роли (только для суперадмина, и не для себя) */}
                                    {currentUser.role === 'superadmin' && currentUser.id !== user.id && (
                                        <>
                                            <button
                                                onClick={() => handleRoleChange(user.id, 'operator')}
                                                disabled={user.role === 'operator'}
                                                style={{ marginRight: '5px' }}
                                            >
                                                Сделать Оператором
                                            </button>
                                            <button
                                                onClick={() => handleRoleChange(user.id, 'admin')}
                                                disabled={user.role === 'admin'}
                                                style={{ marginRight: '5px' }}
                                            >
                                                Сделать Админом
                                            </button>
                                            {/* Кнопка удаления (только для суперадмина, и не для себя) */}
                                            <button
                                                onClick={() => handleDeleteUser(user.id, user.username)}
                                                style={{ backgroundColor: '#dc3545', color: 'white' }} // Красный цвет для опасного действия
                                            >
                                                Удалить
                                            </button>
                                        </>
                                    )}
                                    {/* Для администраторов (если бы они могли что-то делать, но текущая логика handleRoleChange не позволяет многого) */}
                                    {/* {currentUser.role === 'admin' && user.role === 'operator' && currentUser.id !== user.id && (
                                        <span>-</span> // Пример
                                    )} */}
                                    {currentUser.id === user.id && <span>(Это вы)</span>}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            )}
        </div>
    );
};

export default UserManagementPage;