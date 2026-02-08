import mysql.connector
from mysql.connector import Error
import os
import time

def get_db_connection():
    """データベース接続を取得する（リトライ機能付き）"""
    retries = 5
    while retries > 0:
        try:
            connection = mysql.connector.connect(
                host=os.environ.get('DB_HOST', 'localhost'),
                user=os.environ.get('DB_USER', 'root'),
                password=os.environ.get('DB_PASSWORD', ''),
                database=os.environ.get('DB_NAME', 'baseball_live')
            )
            if connection.is_connected():
                return connection
        except Error as e:
            print(f"Error connecting to MySQL: {e}")
            retries -= 1
            time.sleep(2)
    return None
