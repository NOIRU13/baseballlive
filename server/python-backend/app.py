from flask import Flask, request, jsonify, send_file
from flask_cors import CORS
import pandas as pd
import mysql.connector
from database import get_db_connection
import io
import os

app = Flask(__name__)
CORS(app)

@app.route('/health', methods=['GET'])
def health_check():
    return jsonify({"status": "healthy", "service": "baseball-stats-api"})

@app.route('/api/import/csv', methods=['POST'])
def import_csv():
    # ... (前回の実装と同じ) ...
    if 'file' not in request.files:
        return jsonify({"error": "No file part"}), 400
    
    file = request.files['file']
    if file.filename == '':
        return jsonify({"error": "No selected file"}), 400
    
    import_type = request.form.get('type')
    if import_type not in ['batting', 'pitching', 'players']:
        return jsonify({"error": "Invalid import type. Must be 'batting', 'pitching', or 'players'."}), 400

    try:
        # CSVをPandasで読み込み
        content = file.stream.read()
        dtype_options = None
        if import_type == 'players':
            dtype_options = {'number': str}
            
        try:
            stream = io.StringIO(content.decode('utf-8'))
        except UnicodeDecodeError:
            stream = io.StringIO(content.decode('cp932')) # Shift-JIS (Windows) fallback
            
        df = pd.read_csv(stream, dtype=dtype_options)
        
        # NaNをNoneに変換
        df = df.where(pd.notnull(df), None)
        
        conn = get_db_connection()
        if not conn:
             return jsonify({"error": "Database connection failed"}), 500
             
        cursor = conn.cursor()
        count = 0

        if import_type == 'players':
            query = """
                INSERT INTO players (team_id, name, number, position, hand) 
                VALUES (%s, %s, %s, %s, %s)
            """
            for _, row in df.iterrows():
                if pd.isna(row.get('team_id')) or pd.isna(row.get('name')):
                    continue
                # 値を取り出し、NaNならNoneにする関数
                def get_val(row, key, transform=None):
                    val = row.get(key)
                    if pd.isna(val):
                        return None
                    return transform(val) if transform else val

                params = (
                    get_val(row, 'team_id'), 
                    get_val(row, 'name'), 
                    get_val(row, 'number'), 
                    get_val(row, 'position'), 
                    get_val(row, 'hand')
                )
                try:
                    cursor.execute(query, params)
                    count += 1
                except mysql.connector.IntegrityError as e:
                    conn.rollback()
                    # エラーメッセージから判定
                    err_msg = str(e)
                    if "Duplicate entry" in err_msg:
                        return jsonify({"success": False, "error": "データが重複しています（背番号または名前）"}), 409
                    elif "foreign key constraint fails" in err_msg:
                        return jsonify({"success": False, "error": "指定されたチームIDが存在しません"}), 400
                    else:
                        return jsonify({"success": False, "error": f"データベースエラー: {err_msg}"}), 500

        elif import_type == 'batting':
            query = """
                INSERT INTO batting_stats 
                (player_id, season, batting_average, games, at_bats, hits, home_runs, rbis, ops) 
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
                ON DUPLICATE KEY UPDATE 
                batting_average = VALUES(batting_average),
                games = VALUES(games),
                at_bats = VALUES(at_bats),
                hits = VALUES(hits),
                home_runs = VALUES(home_runs),
                rbis = VALUES(rbis),
                ops = VALUES(ops)
            """
            for _, row in df.iterrows():
                if pd.isna(row.get('player_id')) or pd.isna(row.get('season')):
                    continue
                # 値を取り出し、NaNならNoneにする関数 (再定義不要だがスコープ的にここで定義)
                def get_val(row, key, transform=None):
                    val = row.get(key)
                    if pd.isna(val):
                        return None
                    return transform(val) if transform else val

                params = (
                    get_val(row, 'player_id'), get_val(row, 'season'), get_val(row, 'batting_average'),
                    get_val(row, 'games'), get_val(row, 'at_bats'), get_val(row, 'hits'),
                    get_val(row, 'home_runs'), get_val(row, 'rbis'), get_val(row, 'ops')
                )
                cursor.execute(query, params)
                count += 1

        elif import_type == 'pitching':
            query = """
                INSERT INTO pitching_stats 
                (player_id, season, era, games, wins, losses, saves, innings_pitched, strikeouts) 
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
                ON DUPLICATE KEY UPDATE 
                era = VALUES(era),
                games = VALUES(games),
                wins = VALUES(wins),
                losses = VALUES(losses),
                saves = VALUES(saves),
                innings_pitched = VALUES(innings_pitched),
                strikeouts = VALUES(strikeouts)
            """
            for _, row in df.iterrows():
                 if pd.isna(row.get('player_id')) or pd.isna(row.get('season')):
                    continue

                 # 値を取り出し、NaNならNoneにする関数
                 def get_val(row, key, transform=None):
                    val = row.get(key)
                    if pd.isna(val):
                        return None
                    return transform(val) if transform else val

                 params = (
                    get_val(row, 'player_id'), get_val(row, 'season'), get_val(row, 'era'),
                    get_val(row, 'games'), get_val(row, 'wins'), get_val(row, 'losses'),
                    get_val(row, 'saves'), get_val(row, 'innings_pitched'), get_val(row, 'strikeouts')
                 )
                 cursor.execute(query, params)
                 count += 1

        conn.commit()
        cursor.close()
        conn.close()
        
        return jsonify({"success": True, "count": count, "message": f"Successfully imported {count} records"}), 200

    except Exception as e:
        print(f"Error: {e}")
        return jsonify({"success": False, "error": str(e)}), 500

@app.route('/api/export/csv', methods=['GET'])
def export_csv():
    export_type = request.args.get('type')
    if export_type not in ['batting', 'pitching', 'players']:
        return jsonify({"error": "Invalid export type"}), 400

    try:
        conn = get_db_connection()
        if not conn:
             return jsonify({"error": "Database connection failed"}), 500
        
        query = ""
        if export_type == 'batting':
            query = "SELECT * FROM batting_stats"
        elif export_type == 'pitching':
            query = "SELECT * FROM pitching_stats"
        elif export_type == 'players':
            query = "SELECT * FROM players"
            
        df = pd.read_sql(query, conn)
        conn.close()
        
        # CSV文字列を作成
        csv_buffer = io.StringIO()
        df.to_csv(csv_buffer, index=False)
        csv_buffer.seek(0)
        
        # バイト列に変換
        mem = io.BytesIO()
        mem.write(csv_buffer.getvalue().encode('utf-8'))
        mem.seek(0)
        
        return send_file(
            mem,
            mimetype='text/csv',
            as_attachment=True,
            download_name=f'{export_type}_stats.csv'
        )

    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/stats/<type>', methods=['GET'])
def get_stats(type):
    if type not in ['batting', 'pitching']:
        return jsonify({"error": "Invalid stats type"}), 400
        
    try:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        
        query = ""
        if type == 'batting':
            query = """
                SELECT b.*, p.name as player_name, t.short_name as team_name
                FROM batting_stats b
                JOIN players p ON b.player_id = p.id
                JOIN teams t ON p.team_id = t.id
                ORDER BY b.season DESC, b.batting_average DESC
                LIMIT 100
            """
        else:
            query = """
                SELECT pi.*, p.name as player_name, t.short_name as team_name
                FROM pitching_stats pi
                JOIN players p ON pi.player_id = p.id
                JOIN teams t ON p.team_id = t.id
                ORDER BY pi.season DESC, pi.era ASC
                LIMIT 100
            """
            
        cursor.execute(query)
        result = cursor.fetchall()
        
        cursor.close()
        conn.close()
        
        return jsonify(result), 200
        
    except Exception as e:
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port, debug=True)
