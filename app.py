from flask import Flask, render_template, request, redirect, url_for, session, jsonify
from flask_sqlalchemy import SQLAlchemy
from datetime import datetime
from dateutil import parser
import traceback

app = Flask(__name__)
app.secret_key = 'NULPproject2025'
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///neww_database.db'

db = SQLAlchemy(app)

# ──────────────── МОДЕЛІ ────────────────

class User(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), unique=True)
    password = db.Column(db.String(120))
    activities = db.relationship('Activity', backref='user', lazy=True)

class Activity(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    date = db.Column(db.Date)
    start_time = db.Column(db.String(5))
    end_time = db.Column(db.String(5))
    notes = db.Column(db.String(255))
    salary = db.Column(db.Float)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)

class Feedback(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    subject = db.Column(db.String(50))
    name = db.Column(db.String(100))
    message = db.Column(db.Text)
    timestamp = db.Column(db.DateTime, default=datetime.utcnow)

with app.app_context():
    db.create_all()

# ──────────────── МАРШРУТИ ────────────────

@app.route('/')
def index():
    feedbacks = Feedback.query.order_by(Feedback.timestamp.desc()).all()
    return render_template('index.html', feedbacks=feedbacks)

@app.route('/register', methods=['GET', 'POST'])
def register():
    if request.method == 'POST':
        username = request.form['username']
        password = request.form['password']
        if User.query.filter_by(username=username).first():
            return 'User already exists'
        user = User(username=username, password=password)
        db.session.add(user)
        db.session.commit()
        return redirect(url_for('login'))
    return render_template('register.html')

@app.route('/login', methods=['GET', 'POST'])
def login():
    if request.method == 'POST':
        user = User.query.filter_by(username=request.form['username'], password=request.form['password']).first()
        if user:
            session['user_id'] = user.id
            return redirect(url_for('dashboard'))
        else:
            return 'Invalid credentials'
    return render_template('login.html')

@app.route('/dashboard')
def dashboard():
    if 'user_id' not in session:
        return redirect(url_for('login'))
    user = User.query.get(session['user_id'])
    return render_template('calendar.html', username=user.username)

@app.route('/events')
def get_events():
    if 'user_id' not in session:
        return jsonify([])
    try:
        start = request.args.get('start')
        end = request.args.get('end')

        query = Activity.query.filter_by(user_id=session['user_id'])

        if start and end:
            start_date = parser.parse(start).date()
            end_date = parser.parse(end).date()
            query = query.filter(Activity.date >= start_date, Activity.date <= end_date)

        activities = query.all()
        events = [{
            'title': 'work',
            'start': act.date.isoformat(),
            'id': act.id
        } for act in activities]

        return jsonify(events)
    except Exception as e:
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500

@app.route('/event/<string:date>', methods=['GET'])
def get_event(date):
    if 'user_id' not in session:
        return jsonify({'error': 'Unauthorized'}), 401
    try:
        parsed_date = parser.parse(date).date()
        event = Activity.query.filter_by(user_id=session['user_id'], date=parsed_date).first()
        if event:
            return jsonify({
                'start': event.start_time,
                'end': event.end_time,
                'notes': event.notes,
                'salary': event.salary,
                'id': event.id
            })
        return jsonify({})
    except Exception as e:
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500

@app.route('/event', methods=['POST'])
def save_event():
    if 'user_id' not in session:
        return jsonify({'error': 'Unauthorized'}), 401
    data = request.json
    try:
        date = parser.parse(data['date']).date()
        existing = Activity.query.filter_by(user_id=session['user_id'], date=date).first()

        if not existing:
            activity = Activity(
                date=date,
                start_time=data['start'],
                end_time=data['end'],
                notes=data['notes'],
                salary=data['salary'],
                user_id=session['user_id']
            )
            db.session.add(activity)
        else:
            existing.start_time = data['start']
            existing.end_time = data['end']
            existing.notes = data['notes']
            existing.salary = data['salary']

        db.session.commit()
        return jsonify({'success': True})
    except Exception as e:
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500

@app.route('/event/delete/<int:event_id>', methods=['POST'])
def delete_event(event_id):
    if 'user_id' not in session:
        return jsonify({'error': 'Unauthorized'}), 401
    activity = Activity.query.get(event_id)
    if activity and activity.user_id == session['user_id']:
        db.session.delete(activity)
        db.session.commit()
        return jsonify({'success': True})
    return jsonify({'error': 'Not found'}), 404

@app.route('/logout')
def logout():
    session.pop('user_id', None)
    return redirect(url_for('index'))

@app.route('/submit_feedback', methods=['POST'])
def submit_feedback():
    try:
        subject = request.form['subject']
        name = request.form['name']
        message = request.form['message']

        if not subject or not name or not message:
            return 'Будь ласка, заповніть усі поля', 400

        feedback = Feedback(subject=subject, name=name, message=message)
        db.session.add(feedback)
        db.session.commit()

        return redirect(url_for('index'))
    except Exception as e:
        traceback.print_exc()
        return 'Помилка при збереженні відгуку', 500

# ---------------- НОВИЙ API для статистики ----------------
from flask import make_response

@app.route('/statistics', methods=['POST'])
def calculate_statistics():
    if 'user_id' not in session:
        return jsonify({'error': 'Unauthorized'}), 401

    try:
        data = request.json
        period = data.get('period')
        start_date = None
        end_date = None

        today = datetime.today().date()

        if period == 'week':
            start_date = today.replace(day=max(1, today.day - 7))
            end_date = today
        elif period == 'month':
            start_date = today.replace(day=1)
            end_date = today
        elif period == 'year':
            start_date = today.replace(month=1, day=1)
            end_date = today
        elif period == 'custom':
            start_date = parser.parse(data.get('start_date')).date()
            end_date = parser.parse(data.get('end_date')).date()
        else:
            return jsonify({'error': 'Невідомий період'}), 400

        query = Activity.query.filter(
            Activity.user_id == session['user_id'],
            Activity.date >= start_date,
            Activity.date <= end_date
        )

        activities = query.all()
        if not activities:
            return jsonify({
                'total_hours': 0,
                'total_salary': 0,
                'max_hours': 0,
                'min_hours': 0,
                'max_salary': 0,
                'min_salary': 0,
                'details': []
            })

        def calc_duration(a):
            h1, m1 = map(int, a.start_time.split(":"))
            h2, m2 = map(int, a.end_time.split(":"))
            return (h2 * 60 + m2 - h1 * 60 - m1) / 60.0

        durations = [calc_duration(a) for a in activities]
        salaries = [a.salary for a in activities]

        return jsonify({
            'total_hours': round(sum(durations), 2),
            'total_salary': round(sum(salaries), 2),
            'max_hours': round(max(durations), 2),
            'min_hours': round(min(durations), 2),
            'max_salary': round(max(salaries), 2),
            'min_salary': round(min(salaries), 2),
            'details': [
                {
                    'date': a.date.strftime('%d.%m.%Y'),
                    'duration': round(calc_duration(a), 2),
                    'salary': a.salary
                }
                for a in activities
            ]
        })

    except Exception as e:
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500


if __name__ == '__main__':
    with app.app_context():
        db.create_all()
    app.run(debug=True)
