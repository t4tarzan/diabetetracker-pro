from flask import Flask, render_template, jsonify, request
from flask_cors import CORS
import sqlite3
from datetime import datetime, timedelta
import json
import math

app = Flask(__name__, static_folder='static', template_folder='templates')
CORS(app)

def init_db():
    conn = sqlite3.connect('diabetes.db')
    c = conn.cursor()
    
    # Create tables
    c.execute('''CREATE TABLE IF NOT EXISTS measurements
                 (id INTEGER PRIMARY KEY AUTOINCREMENT,
                  timestamp TEXT NOT NULL,
                  glucose REAL,
                  carbs INTEGER,
                  insulin REAL,
                  activity TEXT)''')
    
    c.execute('''CREATE TABLE IF NOT EXISTS meal_plans
                 (id INTEGER PRIMARY KEY AUTOINCREMENT,
                  timestamp TEXT NOT NULL,
                  meal_type TEXT,
                  name TEXT,
                  carbs INTEGER,
                  protein TEXT)''')
    
    c.execute('''CREATE TABLE IF NOT EXISTS workout_plans
                 (id INTEGER PRIMARY KEY AUTOINCREMENT,
                  timestamp TEXT NOT NULL,
                  workout_type TEXT,
                  duration INTEGER,
                  intensity TEXT,
                  glucose_impact TEXT)''')
    
    # Add sample data if the measurements table is empty
    c.execute('SELECT COUNT(*) FROM measurements')
    if c.fetchone()[0] == 0:
        # Sample data for the last 24 hours
        base_time = datetime.now() - timedelta(days=1)
        sample_data = [
            (base_time + timedelta(hours=i), 
             110 + 20 * math.sin(i/4),  # Glucose varies sinusoidally
             50 if i % 8 == 0 else 0,   # Carbs every 8 hours
             5 if i % 8 == 0 else 0,    # Insulin with meals
             'moderate' if i % 12 == 0 else None  # Exercise every 12 hours
            ) for i in range(24)]
        
        c.executemany('''INSERT INTO measurements 
                        (timestamp, glucose, carbs, insulin, activity)
                        VALUES (?, ?, ?, ?, ?)''',
                     [(t.isoformat(), g, carbs, ins, act) 
                      for t, g, carbs, ins, act in sample_data])
    
    conn.commit()
    conn.close()

@app.route('/')
def home():
    return render_template('index.html')

@app.route('/api/add_measurement', methods=['POST'])
def add_measurement():
    data = request.json
    conn = sqlite3.connect('diabetes.db')
    c = conn.cursor()
    c.execute('''INSERT INTO measurements (timestamp, glucose, carbs, insulin, activity)
                 VALUES (?, ?, ?, ?, ?)''',
              (datetime.now().isoformat(), 
               data.get('glucose'), 
               data.get('carbs'), 
               data.get('insulin'),
               data.get('activity')))
    conn.commit()
    conn.close()
    return jsonify({"status": "success"})

@app.route('/api/get_measurements')
def get_measurements():
    conn = sqlite3.connect('diabetes.db')
    c = conn.cursor()
    c.execute('SELECT * FROM measurements ORDER BY timestamp DESC LIMIT 10')
    measurements = [{"id": row[0], 
                    "timestamp": row[1],
                    "glucose": row[2],
                    "carbs": row[3],
                    "insulin": row[4],
                    "activity": row[5]} for row in c.fetchall()]
    conn.close()
    return jsonify(measurements)

@app.route('/api/stats')
def get_stats():
    conn = sqlite3.connect('diabetes.db')
    c = conn.cursor()
    
    # Get last 24 hours of data
    yesterday = (datetime.now() - timedelta(days=1)).isoformat()
    c.execute('''SELECT AVG(glucose), MIN(glucose), MAX(glucose), COUNT(*)
                 FROM measurements
                 WHERE timestamp > ?''', (yesterday,))
    avg, min_glucose, max_glucose, count = c.fetchone()
    
    stats = {
        "last24h": {
            "average": round(avg, 1) if avg else 0,
            "min": round(min_glucose, 1) if min_glucose else 0,
            "max": round(max_glucose, 1) if max_glucose else 0,
            "readings": count
        }
    }
    
    conn.close()
    return jsonify(stats)

@app.route('/api/save_meal_plan', methods=['POST'])
def save_meal_plan():
    data = request.json
    conn = sqlite3.connect('diabetes.db')
    c = conn.cursor()
    c.execute('''INSERT INTO meal_plans (timestamp, meal_type, name, carbs, protein)
                 VALUES (?, ?, ?, ?, ?)''',
              (datetime.now().isoformat(),
               data.get('meal_type'),
               data.get('name'),
               data.get('carbs'),
               data.get('protein')))
    conn.commit()
    conn.close()
    return jsonify({"status": "success"})

@app.route('/api/save_workout_plan', methods=['POST'])
def save_workout_plan():
    data = request.json
    conn = sqlite3.connect('diabetes.db')
    c = conn.cursor()
    c.execute('''INSERT INTO workout_plans (timestamp, workout_type, duration, intensity, glucose_impact)
                 VALUES (?, ?, ?, ?, ?)''',
              (datetime.now().isoformat(),
               data.get('workout_type'),
               data.get('duration'),
               data.get('intensity'),
               data.get('glucose_impact')))
    conn.commit()
    conn.close()
    return jsonify({"status": "success"})

if __name__ == '__main__':
    try:
        init_db()
        print("Starting server at http://127.0.0.1:3000")
        app.run(port=3000, debug=False)
    except Exception as e:
        print(f"Error starting server: {e}")
