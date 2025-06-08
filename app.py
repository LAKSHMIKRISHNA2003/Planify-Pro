from flask import Flask, render_template, request, redirect, url_for, jsonify
from flask_sqlalchemy import SQLAlchemy
from datetime import datetime
import os

app = Flask(__name__)
app.config['SECRET_KEY'] = 'your-secret-key-here'
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///taskflow.db'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

db = SQLAlchemy(app)

# Enhanced Task Model
class Task(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    content = db.Column(db.Text, nullable=False)
    completed = db.Column(db.Boolean, default=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    priority = db.Column(db.String(20), default='medium')
    
    def to_dict(self):
        """Convert task to dictionary for JSON serialization"""
        return {
            'id': self.id,
            'content': self.content,
            'completed': self.completed,
            'priority': self.priority,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None
        }
    
    def __repr__(self):
        return f'<Task {self.id}: {self.content[:50]}{"..." if len(self.content) > 50 else ""}>'

# Routes
@app.route('/')
def index():
    """Main application page"""
    return render_template('index.html')

# API Routes
@app.route('/api/tasks', methods=['GET'])
def api_get_tasks():
    """Get all tasks with optional filtering and sorting"""
    try:
        # Get query parameters
        filter_type = request.args.get('filter', 'all')
        sort_by = request.args.get('sort', 'created_at')
        order = request.args.get('order', 'desc')
        priority = request.args.get('priority')
        
        # Build query
        query = Task.query
        
        # Apply filters
        if filter_type == 'completed':
            query = query.filter(Task.completed == True)
        elif filter_type == 'pending':
            query = query.filter(Task.completed == False)
        
        if priority and priority in ['low', 'medium', 'high']:
            query = query.filter(Task.priority == priority)
        
        # Apply sorting
        if sort_by == 'created_at':
            if order == 'desc':
                query = query.order_by(Task.created_at.desc())
            else:
                query = query.order_by(Task.created_at.asc())
        elif sort_by == 'priority':
            # Custom priority order: high, medium, low
            priority_order = {'high': 1, 'medium': 2, 'low': 3}
            tasks = query.all()
            tasks.sort(key=lambda x: priority_order.get(x.priority, 2))
            if order == 'desc':
                tasks.reverse()
            return jsonify([task.to_dict() for task in tasks])
        
        tasks = query.all()
        return jsonify([task.to_dict() for task in tasks])
        
    except Exception as e:
        app.logger.error(f"Error fetching tasks: {str(e)}")
        return jsonify({'error': 'Failed to fetch tasks'}), 500

@app.route('/api/add_task', methods=['POST'])
def api_add_task():
    """Add a new task"""
    try:
        data = request.get_json()
        
        if not data:
            return jsonify({'success': False, 'error': 'No data provided'}), 400
        
        content = data.get('content', '').strip()
        priority = data.get('priority', 'medium')
        
        if not content:
            return jsonify({'success': False, 'error': 'Task content is required'}), 400
        
        if priority not in ['low', 'medium', 'high']:
            priority = 'medium'
        
        # Create new task
        new_task = Task(
            content=content,
            priority=priority
        )
        
        db.session.add(new_task)
        db.session.commit()
        
        app.logger.info(f"New task created: {new_task.id} - {content[:50]}")
        
        return jsonify({
            'success': True,
            'task': new_task.to_dict(),
            'message': 'Task added successfully'
        })
        
    except Exception as e:
        db.session.rollback()
        app.logger.error(f"Error adding task: {str(e)}")
        return jsonify({'success': False, 'error': 'Failed to add task'}), 500

@app.route('/api/toggle_task/<int:task_id>', methods=['POST'])
def api_toggle_task(task_id):
    """Toggle task completion status"""
    try:
        task = Task.query.get_or_404(task_id)
        
        task.completed = not task.completed
        task.updated_at = datetime.utcnow()
        
        db.session.commit()
        
        status = "completed" if task.completed else "pending"
        app.logger.info(f"Task {task_id} marked as {status}")
        
        return jsonify({
            'success': True,
            'task': task.to_dict(),
            'message': f'Task marked as {status}'
        })
        
    except Exception as e:
        db.session.rollback()
        app.logger.error(f"Error toggling task {task_id}: {str(e)}")
        return jsonify({'success': False, 'error': 'Failed to update task'}), 500

@app.route('/api/delete_task/<int:task_id>', methods=['DELETE'])
def api_delete_task(task_id):
    """Delete a specific task"""
    try:
        task = Task.query.get_or_404(task_id)
        
        db.session.delete(task)
        db.session.commit()
        
        app.logger.info(f"Task deleted: {task_id}")
        
        return jsonify({
            'success': True,
            'message': 'Task deleted successfully'
        })
        
    except Exception as e:
        db.session.rollback()
        app.logger.error(f"Error deleting task {task_id}: {str(e)}")
        return jsonify({'success': False, 'error': 'Failed to delete task'}), 500

@app.route('/api/clear_completed', methods=['DELETE'])
def api_clear_completed():
    """Delete all completed tasks"""
    try:
        completed_tasks = Task.query.filter(Task.completed == True).all()
        deleted_count = len(completed_tasks)
        
        if deleted_count == 0:
            return jsonify({
                'success': True,
                'deleted_count': 0,
                'message': 'No completed tasks to delete'
            })
        
        # Delete all completed tasks
        Task.query.filter(Task.completed == True).delete()
        db.session.commit()
        
        app.logger.info(f"Cleared {deleted_count} completed tasks")
        
        return jsonify({
            'success': True,
            'deleted_count': deleted_count,
            'message': f'{deleted_count} completed tasks deleted'
        })
        
    except Exception as e:
        db.session.rollback()
        app.logger.error(f"Error clearing completed tasks: {str(e)}")
        return jsonify({'success': False, 'error': 'Failed to clear completed tasks'}), 500

@app.route('/api/update_task/<int:task_id>', methods=['PUT'])
def api_update_task(task_id):
    """Update task content or priority"""
    try:
        task = Task.query.get_or_404(task_id)
        data = request.get_json()
        
        if not data:
            return jsonify({'success': False, 'error': 'No data provided'}), 400
        
        # Update fields if provided
        if 'content' in data:
            content = data['content'].strip()
            if not content:
                return jsonify({'success': False, 'error': 'Task content cannot be empty'}), 400
            task.content = content
        
        if 'priority' in data:
            priority = data['priority']
            if priority in ['low', 'medium', 'high']:
                task.priority = priority
        
        if 'completed' in data:
            task.completed = bool(data['completed'])
        
        task.updated_at = datetime.utcnow()
        db.session.commit()
        
        app.logger.info(f"Task updated: {task_id}")
        
        return jsonify({
            'success': True,
            'task': task.to_dict(),
            'message': 'Task updated successfully'
        })
        
    except Exception as e:
        db.session.rollback()
        app.logger.error(f"Error updating task {task_id}: {str(e)}")
        return jsonify({'success': False, 'error': 'Failed to update task'}), 500

@app.route('/api/stats', methods=['GET'])
def api_get_stats():
    """Get task statistics"""
    try:
        total_tasks = Task.query.count()
        completed_tasks = Task.query.filter(Task.completed == True).count()
        pending_tasks = total_tasks - completed_tasks
        
        # Priority breakdown
        high_priority = Task.query.filter(Task.priority == 'high').count()
        medium_priority = Task.query.filter(Task.priority == 'medium').count()
        low_priority = Task.query.filter(Task.priority == 'low').count()
        
        # Completion rate
        completion_rate = round((completed_tasks / total_tasks) * 100, 1) if total_tasks > 0 else 0
        
        # Recent activity (tasks created in last 24 hours)
        from datetime import timedelta
        yesterday = datetime.utcnow() - timedelta(days=1)
        recent_tasks = Task.query.filter(Task.created_at >= yesterday).count()
        
        return jsonify({
            'total_tasks': total_tasks,
            'completed_tasks': completed_tasks,
            'pending_tasks': pending_tasks,
            'completion_rate': completion_rate,
            'priority_breakdown': {
                'high': high_priority,
                'medium': medium_priority,
                'low': low_priority
            },
            'recent_tasks': recent_tasks
        })
        
    except Exception as e:
        app.logger.error(f"Error getting stats: {str(e)}")
        return jsonify({'error': 'Failed to get statistics'}), 500

# Legacy routes for backward compatibility
@app.route('/add_task', methods=['POST'])
def add_task():
    """Legacy route for adding tasks (redirects to main page)"""
    task_content = request.form.get('content')
    priority = request.form.get('priority', 'medium')
    
    if task_content:
        new_task = Task(content=task_content, priority=priority)
        db.session.add(new_task)
        db.session.commit()
    
    return redirect(url_for('index'))

@app.route('/delete_task/<int:task_id>')
def delete_task(task_id):
    """Legacy route for deleting tasks"""
    task = Task.query.get_or_404(task_id)
    db.session.delete(task)
    db.session.commit()
    return redirect(url_for('index'))

@app.route('/toggle_task/<int:task_id>')
def toggle_task(task_id):
    """Legacy route for toggling tasks"""
    task = Task.query.get_or_404(task_id)
    task.completed = not task.completed
    task.updated_at = datetime.utcnow()
    db.session.commit()
    return redirect(url_for('index'))

# Error handlers
@app.errorhandler(404)
def not_found(error):
    if request.path.startswith('/api/'):
        return jsonify({'error': 'Resource not found'}), 404
    return render_template('index.html'), 404

@app.errorhandler(500)
def internal_error(error):
    db.session.rollback()
    if request.path.startswith('/api/'):
        return jsonify({'error': 'Internal server error'}), 500
    return render_template('index.html'), 500

# Database initialization
def init_db():
    """Initialize database with sample data if empty"""
    with app.app_context():
        db.create_all()
        
        # Add sample tasks if database is empty
        if Task.query.count() == 0:
            sample_tasks = [
                Task(content="Welcome to TaskFlow! This is your first task.", priority="medium"),
                Task(content="Try adding a new task above", priority="low"),
                Task(content="Mark tasks as complete by clicking the checkbox", priority="high", completed=True),
                Task(content="Delete tasks using the trash icon", priority="medium"),
            ]
            
            for task in sample_tasks:
                db.session.add(task)
            
            db.session.commit()
            print("Database initialized with sample tasks")

if __name__ == "__main__":
    # Initialize database
    init_db()
    
    # Configure logging
    import logging
    logging.basicConfig(level=logging.INFO)
    
    print("🚀 TaskFlow Pro starting...")
    print("📊 Database initialized")
    print("🌐 Access your app at: http://localhost:5001")
    print("📚 API Documentation available at endpoints starting with /api/")
    
    app.run(debug=True, host='0.0.0.0', port=5001)