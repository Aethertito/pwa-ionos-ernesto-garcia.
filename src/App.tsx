import { useState, useEffect } from 'react'
import './App.css'

interface Task {
  id: string
  title: string
  completed: boolean
  createdAt: number
}

type Filter = 'all' | 'active' | 'completed'

const STORAGE_KEY = 'pwa-tasks-ernesto'

function App() {
  const [tasks, setTasks] = useState<Task[]>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      return stored ? (JSON.parse(stored) as Task[]) : []
    } catch {
      return []
    }
  })
  const [input, setInput] = useState('')
  const [filter, setFilter] = useState<Filter>('all')
  const [isOnline, setIsOnline] = useState(navigator.onLine)

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks))
  }, [tasks])

  useEffect(() => {
    const handleOnline = () => setIsOnline(true)
    const handleOffline = () => setIsOnline(false)
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  const addTask = () => {
    const trimmed = input.trim()
    if (!trimmed) return
    const task: Task = {
      id: crypto.randomUUID(),
      title: trimmed,
      completed: false,
      createdAt: Date.now(),
    }
    setTasks((prev) => [task, ...prev])
    setInput('')
  }

  const toggleTask = (id: string) => {
    setTasks((prev) =>
      prev.map((t) => (t.id === id ? { ...t, completed: !t.completed } : t))
    )
  }

  const deleteTask = (id: string) => {
    setTasks((prev) => prev.filter((t) => t.id !== id))
  }

  const clearCompleted = () => {
    setTasks((prev) => prev.filter((t) => !t.completed))
  }

  const filteredTasks = tasks.filter((t) => {
    if (filter === 'active') return !t.completed
    if (filter === 'completed') return t.completed
    return true
  })

  const activeCount = tasks.filter((t) => !t.completed).length
  const completedCount = tasks.filter((t) => t.completed).length

  return (
    <div className="app">
      <header className="header">
        <div className="header-top">
          <h1>Task Manager</h1>
          <span className={`status-badge ${isOnline ? 'online' : 'offline'}`}>
            {isOnline ? '● Online' : '○ Offline'}
          </span>
        </div>
        <p className="subtitle">
          {activeCount} tarea{activeCount !== 1 ? 's' : ''} pendiente
          {activeCount !== 1 ? 's' : ''}
        </p>
      </header>

      <div className="input-section">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && addTask()}
          placeholder="Escribe una nueva tarea..."
          maxLength={120}
        />
        <button onClick={addTask} disabled={!input.trim()}>
          Agregar
        </button>
      </div>

      <div className="filters">
        {(['all', 'active', 'completed'] as Filter[]).map((f) => (
          <button
            key={f}
            className={filter === f ? 'active' : ''}
            onClick={() => setFilter(f)}
          >
            {f === 'all' ? 'Todas' : f === 'active' ? 'Activas' : 'Completadas'}
            <span className="filter-count">
              {f === 'all'
                ? tasks.length
                : f === 'active'
                ? activeCount
                : completedCount}
            </span>
          </button>
        ))}
      </div>

      <ul className="task-list">
        {filteredTasks.length === 0 && (
          <li className="empty-state">
            <span className="empty-icon">✓</span>
            <span>
              {filter === 'completed'
                ? 'Aún no has completado ninguna tarea'
                : filter === 'active'
                ? '¡No hay tareas pendientes!'
                : 'Agrega tu primera tarea arriba'}
            </span>
          </li>
        )}
        {filteredTasks.map((task) => (
          <li key={task.id} className={task.completed ? 'completed' : ''}>
            <input
              type="checkbox"
              checked={task.completed}
              onChange={() => toggleTask(task.id)}
              aria-label={`Marcar "${task.title}" como ${task.completed ? 'pendiente' : 'completada'}`}
            />
            <span className="task-title">{task.title}</span>
            <button
              className="delete-btn"
              onClick={() => deleteTask(task.id)}
              aria-label={`Eliminar "${task.title}"`}
            >
              ✕
            </button>
          </li>
        ))}
      </ul>

      {completedCount > 0 && (
        <div className="footer-actions">
          <button className="clear-btn" onClick={clearCompleted}>
            Limpiar completadas ({completedCount})
          </button>
        </div>
      )}

      <footer className="app-footer">
        <p>PWA · Ernesto Garcia Valenzuela · UTT</p>
      </footer>
    </div>
  )
}

export default App
