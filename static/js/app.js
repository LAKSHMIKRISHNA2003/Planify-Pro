// Professional Task Management System
class TaskFlowManager {
    constructor() {
        this.tasks = [];
        this.currentFilter = 'all';
        this.sortOrder = 'desc'; // desc = newest first, asc = oldest first
        this.init();
    }

    init() {
        this.bindEvents();
        this.loadTasks();
        this.updateTime();
        setInterval(() => this.updateTime(), 1000);
    }

    bindEvents() {
        // Task form submission
        const form = document.getElementById('task-form');
        if (form) {
            form.addEventListener('submit', (e) => {
                e.preventDefault();
                this.addTask();
            });
        }

        // Filter buttons
        document.querySelectorAll('.filter-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const filter = e.target.closest('.filter-btn').dataset.filter;
                this.setFilter(filter);
            });
        });

        // Clear completed button
        document.getElementById('clear-completed-btn')?.addEventListener('click', () => {
            this.clearCompleted();
        });

        // Sort button
        document.getElementById('sort-btn')?.addEventListener('click', () => {
            this.toggleSort();
        });

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            if (e.ctrlKey || e.metaKey) {
                switch(e.key) {
                    case 'n':
                        e.preventDefault();
                        document.getElementById('task-input').focus();
                        break;
                    case 'a':
                        e.preventDefault();
                        this.setFilter('all');
                        break;
                    case 'p':
                        e.preventDefault();
                        this.setFilter('pending');
                        break;
                    case 'c':
                        e.preventDefault();
                        this.setFilter('completed');
                        break;
                }
            }
        });
    }

    async addTask() {
        const input = document.getElementById('task-input');
        const priority = document.getElementById('priority-select');
        
        const content = input.value.trim();
        if (!content) {
            this.showNotification('Please enter a task description', 'warning');
            input.focus();
            return;
        }

        this.showLoading(true);

        try {
            const response = await fetch('/api/add_task', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    content: content,
                    priority: priority.value
                })
            });

            const result = await response.json();
            
            if (result.success) {
                input.value = '';
                priority.value = 'medium';
                await this.loadTasks();
                this.showNotification('Task added successfully!', 'success');
                
                // Add subtle animation to the new task
                setTimeout(() => {
                    const newTask = document.querySelector(`[data-task-id="${result.task.id}"]`);
                    if (newTask) {
                        newTask.style.animation = 'scaleIn 0.3s ease-out';
                    }
                }, 100);
            } else {
                throw new Error('Failed to add task');
            }
        } catch (error) {
            console.error('Error adding task:', error);
            this.showNotification('Error adding task. Please try again.', 'error');
        } finally {
            this.showLoading(false);
        }
    }

    async loadTasks() {
        try {
            const response = await fetch('/api/tasks');
            const tasks = await response.json();
            this.tasks = tasks;
            this.renderTasks();
            this.updateStats();
        } catch (error) {
            console.error('Error loading tasks:', error);
            this.showNotification('Error loading tasks', 'error');
        }
    }

    renderTasks() {
        const taskList = document.getElementById('task-list');
        const emptyState = document.getElementById('empty-state');
        
        // Filter tasks
        let filteredTasks = this.tasks;
        if (this.currentFilter === 'completed') {
            filteredTasks = this.tasks.filter(task => task.completed);
        } else if (this.currentFilter === 'pending') {
            filteredTasks = this.tasks.filter(task => !task.completed);
        }

        // Sort tasks
        filteredTasks.sort((a, b) => {
            const dateA = new Date(a.created_at);
            const dateB = new Date(b.created_at);
            return this.sortOrder === 'desc' ? dateB - dateA : dateA - dateB;
        });

        if (filteredTasks.length === 0) {
            taskList.style.display = 'none';
            emptyState.style.display = 'block';
            
            if (this.currentFilter !== 'all') {
                emptyState.innerHTML = `
                    <div class="p-16 text-center">
                        <div class="bg-gray-50 rounded-full w-24 h-24 flex items-center justify-center mx-auto mb-6">
                            <i class="fas fa-search text-4xl text-gray-300"></i>
                        </div>
                        <h3 class="text-xl font-semibold text-gray-600 mb-2">No ${this.currentFilter} tasks</h3>
                        <p class="text-gray-500">No tasks match the current filter.</p>
                    </div>
                `;
            } else {
                emptyState.innerHTML = `
                    <div class="p-16 text-center">
                        <div class="bg-gray-50 rounded-full w-24 h-24 flex items-center justify-center mx-auto mb-6">
                            <i class="fas fa-clipboard-list text-4xl text-gray-300"></i>
                        </div>
                        <h3 class="text-xl font-semibold text-gray-600 mb-2">No tasks yet!</h3>
                        <p class="text-gray-500 mb-6">Start organizing your day by adding your first task above.</p>
                        <button class="px-6 py-3 bg-primary-500 text-white rounded-xl hover:bg-primary-600 transition-colors duration-200 font-medium">
                            <i class="fas fa-plus mr-2"></i>Add Your First Task
                        </button>
                    </div>
                `;
            }
            return;
        }

        taskList.style.display = 'block';
        emptyState.style.display = 'none';

        taskList.innerHTML = filteredTasks.map(task => this.renderTaskItem(task)).join('');
        
        // Update task count badge
        document.getElementById('task-count-badge').textContent = filteredTasks.length;
    }

    renderTaskItem(task) {
        const createdAt = new Date(task.created_at);
        const timeAgo = this.getTimeAgo(createdAt);
        
        const priorityConfig = {
            high: { color: 'red', icon: '🔴', bg: 'bg-red-50 border-red-200' },
            medium: { color: 'yellow', icon: '🟡', bg: 'bg-yellow-50 border-yellow-200' },
            low: { color: 'green', icon: '🟢', bg: 'bg-green-50 border-green-200' }
        };

        const config = priorityConfig[task.priority] || priorityConfig.medium;

        return `
            <div class="task-item p-6 hover:bg-gray-50 border-l-4 ${config.bg} transition-all duration-300" 
                 data-task-id="${task.id}"
                 data-status="${task.completed ? 'completed' : 'pending'}">
                <div class="flex items-start space-x-4">
                    <div class="flex-shrink-0 mt-1">
                        <input 
                            type="checkbox" 
                            class="w-5 h-5 text-primary-500 border-2 border-gray-300 rounded focus:ring-primary-500 focus:ring-2 cursor-pointer transition-all duration-200"
                            ${task.completed ? 'checked' : ''}
                            onchange="taskManager.toggleTask(${task.id})"
                        >
                    </div>
                    
                    <div class="flex-1 min-w-0">
                        <div class="flex items-start justify-between">
                            <div class="flex-1 mr-4">
                                <p class="text-lg font-medium text-gray-900 break-words leading-relaxed ${task.completed ? 'line-through text-gray-500' : ''}">
                                    ${this.escapeHtml(task.content)}
                                </p>
                                
                                <div class="flex items-center space-x-3 mt-3 flex-wrap gap-2">
                                    <span class="inline-flex items-center px-3 py-1 text-xs font-medium rounded-full ${config.color === 'red' ? 'bg-red-100 text-red-800' : 
                                        config.color === 'yellow' ? 'bg-yellow-100 text-yellow-800' : 'bg-green-100 text-green-800'}">
                                        ${config.icon} ${task.priority.charAt(0).toUpperCase() + task.priority.slice(1)} Priority
                                    </span>
                                    
                                    <span class="text-xs text-gray-500 flex items-center">
                                        <i class="far fa-clock mr-1"></i>
                                        ${timeAgo}
                                    </span>
                                    
                                    <span class="text-xs text-gray-400">
                                        ${createdAt.toLocaleDateString('en-US', { 
                                            month: 'short', 
                                            day: 'numeric',
                                            hour: '2-digit',
                                            minute: '2-digit'
                                        })}
                                    </span>
                                </div>
                            </div>
                            
                            <div class="flex items-center space-x-2 flex-shrink-0">
                                ${task.completed ? 
                                    '<span class="text-green-500 bg-green-50 p-2 rounded-lg"><i class="fas fa-check-circle"></i></span>' : 
                                    '<span class="text-orange-500 bg-orange-50 p-2 rounded-lg"><i class="fas fa-clock"></i></span>'
                                }
                                <button 
                                    onclick="taskManager.deleteTask(${task.id})"
                                    class="text-red-500 hover:text-red-700 hover:bg-red-50 p-2 rounded-lg transition-all duration-200"
                                    title="Delete task"
                                >
                                    <i class="fas fa-trash"></i>
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    async toggleTask(taskId) {
        this.showLoading(true);
        
        try {
            const response = await fetch(`/api/toggle_task/${taskId}`, {
                method: 'POST'
            });
            
            const result = await response.json();
            
            if (result.success) {
                await this.loadTasks();
                this.showNotification(
                    result.task.completed ? 'Task completed! 🎉' : 'Task marked as pending',
                    result.task.completed ? 'success' : 'info'
                );
            } else {
                throw new Error('Failed to toggle task');
            }
        } catch (error) {
            console.error('Error toggling task:', error);
            this.showNotification('Error updating task', 'error');
        } finally {
            this.showLoading(false);
        }
    }

    async deleteTask(taskId) {
        if (!confirm('Are you sure you want to delete this task? This action cannot be undone.')) {
            return;
        }

        this.showLoading(true);

        try {
            const response = await fetch(`/api/delete_task/${taskId}`, {
                method: 'DELETE'
            });
            
            const result = await response.json();
            
            if (result.success) {
                await this.loadTasks();
                this.showNotification('Task deleted successfully', 'success');
            } else {
                throw new Error('Failed to delete task');
            }
        } catch (error) {
            console.error('Error deleting task:', error);
            this.showNotification('Error deleting task', 'error');
        } finally {
            this.showLoading(false);
        }
    }

    async clearCompleted() {
        const completedTasks = this.tasks.filter(task => task.completed);
        
        if (completedTasks.length === 0) {
            this.showNotification('No completed tasks to clear', 'info');
            return;
        }

        if (!confirm(`Are you sure you want to delete all ${completedTasks.length} completed tasks? This action cannot be undone.`)) {
            return;
        }

        this.showLoading(true);

        try {
            const response = await fetch('/api/clear_completed', {
                method: 'DELETE'
            });
            
            const result = await response.json();
            
            if (result.success) {
                await this.loadTasks();
                this.showNotification(`${result.deleted_count} completed tasks deleted`, 'success');
            } else {
                throw new Error('Failed to clear completed tasks');
            }
        } catch (error) {
            console.error('Error clearing completed tasks:', error);
            this.showNotification('Error clearing completed tasks', 'error');
        } finally {
            this.showLoading(false);
        }
    }

    setFilter(filter) {
        this.currentFilter = filter;
        
        // Update filter buttons
        document.querySelectorAll('.filter-btn').forEach(btn => {
            const isActive = btn.dataset.filter === filter;
            btn.classList.toggle('bg-primary-500', isActive);
            btn.classList.toggle('text-white', isActive);
            btn.classList.toggle('shadow-md', isActive);
            btn.classList.toggle('bg-gray-100', !isActive);
            btn.classList.toggle('text-gray-700', !isActive);
        });
        
        this.renderTasks();
    }

    toggleSort() {
        this.sortOrder = this.sortOrder === 'desc' ? 'asc' : 'desc';
        
        // Update sort button text
        const sortBtn = document.getElementById('sort-btn');
        const icon = sortBtn.querySelector('i');
        const text = this.sortOrder === 'desc' ? 'Newest First' : 'Oldest First';
        sortBtn.innerHTML = `<i class="fas fa-sort mr-2"></i>${text}`;
        
        this.renderTasks();
        this.showNotification(`Sorted by ${text.toLowerCase()}`, 'info');
    }

    updateStats() {
        const total = this.tasks.length;
        const completed = this.tasks.filter(task => task.completed).length;
        const pending = total - completed;
        const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0;

        // Update stat displays with animation
        this.animateNumber('total-tasks', total);
        this.animateNumber('completed-tasks', completed);
        this.animateNumber('pending-tasks', pending);
        this.animateNumber('completion-rate', completionRate, '%');

        // Show/hide clear completed button
        const clearBtn = document.getElementById('clear-completed-btn');
        if (clearBtn) {
            clearBtn.style.display = completed > 0 ? 'block' : 'none';
        }
    }

    animateNumber(elementId, targetValue, suffix = '') {
        const element = document.getElementById(elementId);
        if (!element) return;

        const startValue = parseInt(element.textContent) || 0;
        const increment = targetValue > startValue ? 1 : -1;
        const stepTime = Math.abs(Math.floor(200 / (targetValue - startValue))) || 10;

        const timer = setInterval(() => {
            const currentValue = parseInt(element.textContent) || 0;
            if (currentValue === targetValue) {
                clearInterval(timer);
            } else {
                element.textContent = (currentValue + increment) + suffix;
            }
        }, stepTime);
    }

    showNotification(message, type = 'info') {
        const container = document.getElementById('notification-container');
        const notification = document.createElement('div');
        
        const typeConfig = {
            success: { bg: 'bg-green-500', icon: 'fas fa-check-circle' },
            error: { bg: 'bg-red-500', icon: 'fas fa-exclamation-circle' },
            warning: { bg: 'bg-yellow-500', icon: 'fas fa-exclamation-triangle' },
            info: { bg: 'bg-blue-500', icon: 'fas fa-info-circle' }
        };

        const config = typeConfig[type] || typeConfig.info;
        
        notification.className = `notification ${config.bg} text-white px-6 py-4 rounded-xl shadow-lg flex items-center space-x-3 max-w-sm`;
        notification.innerHTML = `
            <i class="${config.icon}"></i>
            <span class="font-medium">${this.escapeHtml(message)}</span>
            <button onclick="this.parentElement.remove()" class="ml-auto text-white hover:text-gray-200">
                <i class="fas fa-times"></i>
            </button>
        `;

        container.appendChild(notification);

        // Auto remove after 5 seconds
        setTimeout(() => {
            if (notification.parentNode) {
                notification.style.transform = 'translateX(100%)';
                notification.style.opacity = '0';
                setTimeout(() => notification.remove(), 300);
            }
        }, 5000);
    }

    showLoading(show) {
        const overlay = document.getElementById('loading-overlay');
        if (overlay) {
            overlay.style.display = show ? 'flex' : 'none';
        }
    }

    updateTime() {
        const now = new Date();
        const timeString = now.toLocaleTimeString('en-US', { 
            hour: '2-digit', 
            minute: '2-digit',
            hour12: true 
        });
        const dateString = now.toLocaleDateString('en-US', { 
            weekday: 'short', 
            month: 'short', 
            day: 'numeric' 
        });
        
        const timeElement = document.getElementById('current-time');
        if (timeElement) {
            timeElement.textContent = `${dateString} ${timeString}`;
        }
    }

    getTimeAgo(date) {
        const now = new Date();
        const diffMs = now - date;
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMins / 60);
        const diffDays = Math.floor(diffHours / 24);

        if (diffMins < 1) return 'Just now';
        if (diffMins < 60) return `${diffMins}m ago`;
        if (diffHours < 24) return `${diffHours}h ago`;
        if (diffDays < 7) return `${diffDays}d ago`;
        return date.toLocaleDateString();
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // Keyboard shortcut helper
    showKeyboardShortcuts() {
        const shortcuts = `
            <div class="bg-white rounded-xl p-6 max-w-md">
                <h3 class="text-lg font-semibold mb-4">Keyboard Shortcuts</h3>
                <div class="space-y-2 text-sm">
                    <div class="flex justify-between"><span>New Task</span><kbd class="bg-gray-100 px-2 py-1 rounded">Ctrl+N</kbd></div>
                    <div class="flex justify-between"><span>All Tasks</span><kbd class="bg-gray-100 px-2 py-1 rounded">Ctrl+A</kbd></div>
                    <div class="flex justify-between"><span>Pending</span><kbd class="bg-gray-100 px-2 py-1 rounded">Ctrl+P</kbd></div>
                    <div class="flex justify-between"><span>Completed</span><kbd class="bg-gray-100 px-2 py-1 rounded">Ctrl+C</kbd></div>
                </div>
            </div>
        `;
        this.showNotification(shortcuts, 'info');
    }
}

// Initialize the task manager when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.taskManager = new TaskFlowManager();
    
    // Add keyboard shortcut hint
    console.log('TaskFlow Pro loaded! Use Ctrl+N to quickly add tasks, Ctrl+A/P/C to filter.');
});