from flask import Flask, jsonify, request
import mysql.connector
from flask_cors import CORS
import io
import pandas as pd
from flask import send_file
import jwt
import datetime
from functools import wraps
from werkzeug.security import generate_password_hash, check_password_hash

app = Flask(__name__)
app.config['SECRET_KEY'] = 'secretkey123' # For development, in production, environment variables will be used for secrets!
CORS(app)

# --- CLASS DEFINITIONS ---

class DatabaseManager:
    """
    Handles all interactions with the MySQL database.
    This encapsulates the connection logic (Encapsulation).
    """
    def __init__(self):
        self.config = {
            'host': 'localhost',
            'user': 'root',
            'password': 'root123',
            'database': 'powertrack_pro'
        }

    def get_connection(self):
        return mysql.connector.connect(**self.config)

    def fetch_user_by_username(self, username):
        """
        Helper method to retrieve a user record for hash verification.
        """
        conn = self.get_connection()
        cursor = conn.cursor(dictionary=True)
        try:
            query = "SELECT * FROM users WHERE username = %s"
            cursor.execute(query, (username,))
            result = cursor.fetchone()
            return result
        finally:
            cursor.close()
            conn.close()
    
    def get_all_categories(self):
        conn = self.get_connection()
        cursor = conn.cursor(dictionary=True)
        cursor.execute("SELECT * FROM vehicle_categories")
        results = cursor.fetchall()
        cursor.close()
        conn.close()
        return results

    def get_all_services(self):
        conn = self.get_connection()
        cursor = conn.cursor(dictionary=True)
        # Only want active services to show up on the worksheet
        cursor.execute("SELECT * FROM services WHERE is_active = 1")
        results = cursor.fetchall()
        cursor.close()
        conn.close()
        return results

    def get_specific_price(self, service_id, category_id):
        conn = self.get_connection()
        cursor = conn.cursor(dictionary=True)
        query = "SELECT base_price FROM service_pricing WHERE service_id = %s AND vehicle_category_id = %s"
        cursor.execute(query, (service_id, category_id))
        result = cursor.fetchone()
        cursor.close()
        conn.close()
        return result['base_price'] if result else 0
    
    def get_all_active_users(self):
        """Retrieves all users from the system to assign to a wash job."""
        conn = self.get_connection()
        cursor = conn.cursor(dictionary=True)
        # We select everyone because both managers and detailers can perform washes
        cursor.execute("SELECT user_id, user_name FROM users ORDER BY user_name ASC")
        results = cursor.fetchall()
        cursor.close()
        conn.close()
        return results
    
    def lookup_vehicle_by_plate(self, plate):
        """
        Searches for a vehicle and checks if it is currently on an active plan.
        Fulfills Success Criterion #4.
        """
        conn = self.get_connection()
        cursor = conn.cursor(dictionary=True)
        # Normalizing plate: Uppercase and no spaces
        clean_plate = plate.replace(" ", "").upper()
        
        query = """
            SELECT v.vehicle_id, v.vehicle_category_id, v.make_model, 
                   cp.client_name, cp.billing_cycle_type, cp.client_plan_id
            FROM vehicles v
            LEFT JOIN client_plan_vehicles cpv ON v.vehicle_id = cpv.vehicle_id AND cpv.removed_at IS NULL
            LEFT JOIN client_plans cp ON cpv.client_plan_id = cp.client_plan_id
            WHERE v.license_plate = %s
        """
        cursor.execute(query, (clean_plate,))
        result = cursor.fetchone()
        cursor.close()
        conn.close()
        return result

    def get_plate_suggestions(self, partial_plate):
        """Returns list of plates for the autosuggestion dropdown."""
        conn = self.get_connection()
        cursor = conn.cursor(dictionary=True)
        query = "SELECT license_plate FROM vehicles WHERE license_plate LIKE %s LIMIT 5"
        cursor.execute(query, (f"{partial_plate}%",))
        results = cursor.fetchall()
        cursor.close()
        conn.close()
        return [r['license_plate'] for r in results]
    
    def submit_wash_job(self, data):
        """
        Processes a full wash transaction across multiple tables.
        Demonstrates Atomicity and Referential Integrity for Criterion C.
        """
        conn = self.get_connection()
        cursor = conn.cursor(dictionary=True)
        
        try:
            # Start Transaction
            conn.start_transaction()

            # 1. Handle Vehicle (Insert if it's a new plate)
            plate = data['plate'].strip().upper()
            cursor.execute("SELECT vehicle_id FROM vehicles WHERE license_plate = %s", (plate,))
            vehicle = cursor.fetchone()
            
            if vehicle:
                vehicle_id = vehicle['vehicle_id']
            else:
                # If vehicle doesn't exist, create it
                cursor.execute(
                    "INSERT INTO vehicles (license_plate, vehicle_category_id) VALUES (%s, %s)",
                    (plate, data['category_id'])
                )
                vehicle_id = cursor.lastrowid

            # 2. Insert Main Transaction
            # Note: client_plan_id is included to preserve historical billing data
            query_main = """
                INSERT INTO wash_transactions 
                (vehicle_id, client_plan_id, total_price, payment_method, created_by_user_id, notes)
                VALUES (%s, %s, %s, %s, %s, %s)
            """
            cursor.execute(query_main, (
                vehicle_id,
                data.get('client_plan_id'), # Null if not on plan
                data['total_price'],
                data['payment_method'].lower(),
                data['creator_id'], # ID of the logged-in user
                data.get('notes', '')
            ))
            wash_id = cursor.lastrowid

            # 3. Insert Services (with Snapshots for price integrity)
            for service in data['services']:
                # 'service' should contain id, name, and current price
                cursor.execute(
                    """INSERT INTO wash_transaction_services 
                       (wash_transaction_id, service_id, service_name_snapshot, service_price_snapshot)
                       VALUES (%s, %s, %s, %s)""",
                    (wash_id, service['id'], service['name'], service['price'])
                )

            # 4. Insert Employees (Mapping multiple detailers to one job)
            for staff_id in data['staff_ids']:
                cursor.execute(
                    "INSERT INTO wash_transaction_employees (wash_transaction_id, user_id) VALUES (%s, %s)",
                    (wash_id, staff_id)
                )

            # 5. Insert Adjustments (Only if discount or fee > 0)
            if float(data.get('discount', 0)) > 0:
                cursor.execute(
                    """INSERT INTO wash_transaction_adjustments 
                       (wash_transaction_id, adjustment_type, adjustment_amount, adjustment_reason)
                       VALUES (%s, 'discount', %s, %s)""",
                    (wash_id, data['discount'], data.get('discount_reason'))
                )
            
            if float(data.get('fee', 0)) > 0:
                cursor.execute(
                    """INSERT INTO wash_transaction_adjustments 
                       (wash_transaction_id, adjustment_type, adjustment_amount, adjustment_reason)
                       VALUES (%s, 'fee', %s, %s)""",
                    (wash_id, data['fee'], data.get('fee_reason'))
                )

            # Commit all changes if no errors occurred
            conn.commit()
            return {"status": "success", "wash_id": wash_id}

        except Exception as e:
            # Rollback everything if any single insert fails
            conn.rollback()
            raise e
        finally:
            cursor.close()
            conn.close()

    def get_manager_overview(self):
        """Fetches KPI data and recent transactions for the dashboard."""
        conn = self.get_connection()
        cursor = conn.cursor(dictionary=True)
        try:
            # KPI 1: Total Revenue Today
            cursor.execute("SELECT SUM(total_price) as revenue FROM wash_transactions WHERE DATE(logged_at) = CURDATE()")
            revenue = cursor.fetchone()['revenue'] or 0

            # KPI 2: Cars Washed Today
            cursor.execute("SELECT COUNT(*) as count FROM wash_transactions WHERE DATE(logged_at) = CURDATE()")
            cars_count = cursor.fetchone()['count'] or 0

            # KPI 3: Active Plan Washes Today
            cursor.execute("SELECT COUNT(*) as count FROM wash_transactions WHERE DATE(logged_at) = CURDATE() AND payment_method = 'plan'")
            plan_washes = cursor.fetchone()['count'] or 0

            # Recent Transactions (Last 10)
            query_recent = """
                SELECT t.wash_transaction_id, v.license_plate, t.total_price, t.payment_method, t.logged_at
                FROM wash_transactions t
                JOIN vehicles v ON t.vehicle_id = v.vehicle_id
                ORDER BY t.logged_at DESC LIMIT 10
            """
            cursor.execute(query_recent)
            transactions = cursor.fetchall()

            return {
                "kpis": {
                    "revenue": float(revenue),
                    "cars": cars_count,
                    "plans": plan_washes
                },
                "recent": transactions
            }
        finally:
            cursor.close()
            conn.close()

    def get_wash_details(self, wash_id):
        """Fetches all relational data for a specific wash job."""
        conn = self.get_connection()
        cursor = conn.cursor(dictionary=True)
        try:
            # 1. Get Services performed (from snapshot table)
            cursor.execute("""
                SELECT service_name_snapshot, service_price_snapshot 
                FROM wash_transaction_services WHERE wash_transaction_id = %s
            """, (wash_id,))
            services = cursor.fetchall()

            # 2. Get Employees assigned
            cursor.execute("""
                SELECT u.user_name FROM wash_transaction_employees wte
                JOIN users u ON wte.user_id = u.user_id
                WHERE wte.wash_transaction_id = %s
            """, (wash_id,))
            staff = cursor.fetchall()

            # 3. Get Adjustments (Discounts/Fees)
            cursor.execute("""
                SELECT adjustment_type, adjustment_amount, adjustment_reason 
                FROM wash_transaction_adjustments WHERE wash_transaction_id = %s
            """, (wash_id,))
            adjustments = cursor.fetchall()

            return {
                "services": services,
                "staff": [s['user_name'] for s in staff],
                "adjustments": adjustments
            }
        finally:
            cursor.close()
            conn.close()

    def get_filtered_report(self, filters):
        """
        Retrieves wash data and uses Pandas for advanced filtering.
        Demonstrates complex data processing for Criterion C.
        """
        conn = self.get_connection()
        
        # SQL query to get the base dataset
        query = """
            SELECT 
                t.wash_transaction_id as ID,
                v.license_plate as Plate,
                t.total_price as Total,
                t.payment_method as Method,
                t.logged_at as Date,
                u.user_name as CreatedBy
            FROM wash_transactions t
            JOIN vehicles v ON t.vehicle_id = v.vehicle_id
            JOIN users u ON t.created_by_user_id = u.user_id
        """
        
        # Load data directly into a Pandas DataFrame
        df = pd.read_sql(query, conn)
        conn.close()

        # --- ALGORITHM: Pandas Filtering ---
        if not df.empty:
            # 1. Filter by Date Range
            if filters.get('startDate') and filters.get('endDate'):
                df['Date'] = pd.to_datetime(df['Date'])
                mask = (df['Date'] >= filters['startDate']) & (df['Date'] <= filters['endDate'])
                df = df.loc[mask]

            # 2. Filter by Payment Method
            if filters.get('method') and filters.get('method') != 'all':
                df = df[df['Method'] == filters['method'].lower()]

            # 3. Filter by Staff (Created By)
            if filters.get('staffId'):
                # We fetch the username for the filter comparison
                df = df[df['CreatedBy'] == filters['staffName']]

        # Convert back to JSON for the frontend
        return df.to_dict(orient='records')
    
    def get_client_plans_detailed(self):
        """Fetches plans and aggregates their vehicle counts."""
        conn = self.get_connection()
        cursor = conn.cursor(dictionary=True)
        # We join with client_plan_vehicles to show how many cars are on each plan
        query = """
            SELECT cp.*, COUNT(cv.vehicle_id) as vehicle_count 
            FROM client_plans cp
            LEFT JOIN client_plan_vehicles cv ON cp.client_plan_id = cv.client_plan_id
            GROUP BY cp.client_plan_id
        """
        cursor.execute(query)
        result = cursor.fetchall()
        cursor.close()
        conn.close()
        return result

    def add_full_client_plan(self, data):
        """Saves Plan, then Vehicles, then Signature in one transaction."""
        conn = self.get_connection()
        cursor = conn.cursor()
        try:
            # Ensure the frontend sends 'signature' (Base64 string or binary)
            signature_data = data.get('signature', None)

            # Convert Base64 string from React to binary bytes for MySQL LONGBLOB
            if signature_data and "," in signature_data:
                import base64 # Can also be placed at top of file
                signature_data = base64.b64decode(signature_data.split(",")[1])

            # 1. Insert Plan (Email/Phone can be None/Null)
            plan_query = """
                        INSERT INTO client_plans (
                            client_name, billing_cycle_type, contact_email, 
                            contact_phone, client_signature, is_active
                        )
                        VALUES (%s, %s, %s, %s, %s, 1)
                    """
            cursor.execute(plan_query, (
                data['client_name'], 
                data['billing_cycle'], 
                data.get('contact_email'), # .get() returns None if missing
                data.get('contact_phone'),  # .get() returns None if missing
                signature_data
            ))

            plan_id = cursor.lastrowid

            # 2. Insert Vehicles linked to this plan
            for veh in data['vehicles']:
                # First create the vehicle record
                cursor.execute(
                    "INSERT INTO vehicles (category_id, make_model, license_plate) VALUES (%s, %s, %s)",
                    (veh['category_id'], veh['make_model'], veh['license_plate'])
                )
                vehicle_id = cursor.lastrowid
                # Link to the plan
                cursor.execute(
                    "INSERT INTO client_plan_vehicles (client_plan_id, vehicle_id) VALUES (%s, %s)",
                    (plan_id, vehicle_id)
                )

            conn.commit()
            return {"status": "success", "plan_id": plan_id}
        except Exception as e:
            conn.rollback()
            raise e
        finally:
            cursor.close()
            conn.close()

    def generate_username(self, first, last):
        # Base: First letter of first name + first & last letter of last name
        base = (first[0] + last[0] + last[-1]).lower()
        counter = 1
        conn = self.get_connection()
        cursor = conn.cursor()

        while True:
            username = f"{base}{str(counter).zfill(3)}" # e.g., jde001
            cursor.execute("SELECT COUNT(*) FROM users WHERE username = %s", (username,))
            if cursor.fetchone()[0] == 0:
                conn.close()
                return username
            counter += 1

    def toggle_user_active_status(self, user_id):
        """
        Toggles the is_active status of a user.
        Includes a safety check to prevent deactivating the last Manager.
        """
        conn = self.get_connection()
        cursor = conn.cursor(dictionary=True)
        try:
            # 1. Fetch current status and role
            cursor.execute("SELECT role, is_active FROM users WHERE user_id = %s", (user_id,))
            user = cursor.fetchone()
            
            if not user:
                return {"status": "error", "message": "User not found"}

            # 2. Safety Check: Don't deactivate the last active Manager
            if user['role'] == 'Manager' and user['is_active'] == 1:
                cursor.execute("SELECT COUNT(*) as count FROM users WHERE role = 'Manager' AND is_active = 1")
                active_managers = cursor.fetchone()['count']
                if active_managers <= 1:
                    return {"status": "error", "message": "Security Lockout: Cannot deactivate the last active Manager."}

            # 3. Toggle the bit
            new_status = 0 if user['is_active'] == 1 else 1
            cursor.execute("UPDATE users SET is_active = %s WHERE user_id = %s", (new_status, user_id))
            conn.commit()
            
            return {"status": "success", "new_status": new_status}
        
        except Exception as e:
            conn.rollback()
            raise e
        finally:
            cursor.close()
            conn.close()

class User:
    """
    Represents a System User. 
    This allows us to treat the user as an Object rather than just a row of data.
    """
    def __init__(self, data):
        self.id = data.get('user_id') 
        self.role = data.get('user_role')
        
    def to_dict(self):
        return {"user_id": self.id, "user_role": self.role}

# --- INSTANTIATE CORE OBJECTS ---
# We create one instance of our DatabaseManager to be used by the routes
db_manager = DatabaseManager()


# --- API ROUTES ---

@app.route('/login', methods=['POST'])
def login():
    """
    Handles secure authentication by verifying salted password hashes.
    Fulfills Success Criterion #2 (Security) and #5 (Session Management).
    """
    data = request.json
    entered_username = data.get('username')
    entered_password = data.get('password')

    try:
        # 1. Fetch user by username ONLY (Success Criterion #2)
        # We can no longer check password in SQL because it's stored as a hash.
        user_record = db_manager.fetch_user_by_username(entered_username)

        if user_record:
            # 2. VERIFY HASHED PASSWORD
            # check_password_hash takes the salt from the stored hash, 
            # reapplies it to the 'entered_password', and compares the results.
            if not check_password_hash(user_record['password'], entered_password):
                return jsonify({"status": "fail", "message": "Invalid username or password"}), 401

            # 3. Account Status Check (Criterion #6)
            if not user_record.get('is_active'):
                return jsonify({"status": "fail", "message": "Account deactivated"}), 403

            # 4. JWT Token Generation (Fulfills session tracking requirements)
            token = jwt.encode({
                'user_id': user_record['user_id'],
                'role': user_record['user_role'],
                'exp': datetime.datetime.utcnow() + datetime.timedelta(hours=24)
            }, app.config['SECRET_KEY'], algorithm="HS256")

            # 5. Return success data
            return jsonify({
                "status": "success",
                "token": token,
                "role": user_record['user_role'],
                "user_id": user_record['user_id']
            }), 200
            
        else:
            # Generic error message to prevent "username enumerations" (Security best practice)
            return jsonify({"status": "fail", "message": "Invalid username or password"}), 401

    except Exception as e:
        print(f"Login Error: {e}")
        return jsonify({"status": "error", "message": "Internal server error"}), 500
        
@app.route('/test-db', methods=['GET'])
def test_db():
    """Simple test route updated to use the DatabaseManager class."""
    try:
        conn = db_manager.get_connection()
        cursor = conn.cursor(dictionary=True)
        cursor.execute("SELECT user_id, user_name, user_role FROM users")
        users = cursor.fetchall()
        cursor.close()
        conn.close()
        return jsonify({"status": "success", "data": users}), 200
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500
    
@app.route('/categories', methods=['GET'])
def get_categories():
    return jsonify(db_manager.get_all_categories())

@app.route('/services', methods=['GET'])
def get_services():
    return jsonify(db_manager.get_all_services())

@app.route('/calculate-price', methods=['POST'])
def calculate_price():
    data = request.json
    service_id = data.get('service_id')
    category_id = data.get('category_id')
    price = db_manager.get_specific_price(service_id, category_id)
    return jsonify({"price": float(price)})

@app.route('/staff', methods=['GET'])
def get_staff():
    """Endpoint for the staff dropdown menu."""
    try:
        staff = db_manager.get_all_active_users()
        return jsonify(staff), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    
@app.route('/lookup-plate', methods=['GET'])
def lookup_plate():
    plate = request.args.get('plate')
    result = db_manager.lookup_vehicle_by_plate(plate)
    return jsonify(result)

@app.route('/plate-suggestions', methods=['GET'])
def plate_suggestions():
    partial = request.args.get('q')
    return jsonify(db_manager.get_plate_suggestions(partial))

@app.route('/submit-wash', methods=['POST'])
def submit_wash():
    try:
        data = request.json
        # Basic validation
        required_fields = ['plate', 'category_id', 'total_price', 'staff_ids', 'services', 'creator_id']
        if not all(k in data for k in required_fields):
            return jsonify({"status": "error", "message": "Missing required fields"}), 400
            
        result = db_manager.submit_wash_job(data)
        return jsonify(result), 201
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500
    
@app.route('/manager-overview', methods=['GET'])
def manager_overview():
    return jsonify(db_manager.get_manager_overview())
    
@app.route('/wash-details/<int:wash_id>', methods=['GET'])
def wash_details(wash_id):
    return jsonify(db_manager.get_wash_details(wash_id))

@app.route('/generate-report', methods=['POST'])
def generate_report():
    filters = request.json
    report_data = db_manager.get_filtered_report(filters)
    return jsonify(report_data)

@app.route('/export-report', methods=['POST'])
def export_report():
    """
    Exports filtered data to Excel or CSV.
    Demonstrates the use of external libraries (Pandas, OpenPyXL) for data portability.
    """
    data = request.json.get('data') # The filtered data from the frontend state
    format_type = request.json.get('format') # 'excel' or 'csv'
    
    if not data:
        return jsonify({"error": "No data to export"}), 400

    df = pd.DataFrame(data)
    
    # Create an in-memory file-like object
    output = io.BytesIO()
    
    if format_type == 'excel':
        # Requires 'openpyxl' installed: pip install openpyxl
        with pd.ExcelWriter(output, engine='openpyxl') as writer:
            df.to_excel(writer, index=False, sheet_name='Wash_Report')
        mimetype = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        filename = "PowerTrack_Report.xlsx"
    else:
        # CSV Export
        csv_data = df.to_csv(index=False)
        output.write(csv_data.encode())
        mimetype = 'text/csv'
        filename = "PowerTrack_Report.csv"

    output.seek(0)
    return send_file(output, mimetype=mimetype, as_attachment=True, download_name=filename)

@app.route('/api/plans', methods=['GET'])
def api_get_plans():
    return jsonify(db_manager.get_client_plans_detailed())

@app.route('/api/plans/create', methods=['POST'])
def api_create_plan():
    return jsonify(db_manager.add_full_client_plan(request.json))

@app.route('/api/categories', methods=['GET'])
def api_get_categories():
    return jsonify(db_manager.get_all_categories())

@app.route('/api/users', methods=['GET'])
def get_users():
    conn = db_manager.get_connection()
    cursor = conn.cursor(dictionary=True)
    # Use 'AS role' to map the DB column to the name your frontend expects
    cursor.execute("""
        SELECT 
            user_id, 
            user_name AS full_name, 
            username, 
            user_role AS role, 
            is_active 
        FROM users
    """)
    users = cursor.fetchall()
    conn.close()
    return jsonify(users)

@app.route('/api/users/create', methods=['POST'])
def create_user():
    """
    Creates a new user with a hashed password.
    Fulfills Success Criterion #2: Secure Data Storage & RBAC.
    """
    data = request.json
    password = data.get('password', '')

    # --- NEW VALIDATION LOGIC ---
    if len(password) < 8:
        return jsonify({
            "status": "error", 
            "message": "Security Violation: Password must be at least 8 characters long."
        }), 400 # 'Bad Request' status code
    # ----------------------------
    
    # 1. Generate standard display name and unique username
    full_name = f"{data['firstName']} {data['lastName']}"
    username = db_manager.generate_username(data['firstName'], data['lastName'])
    
    # 2. PASSWORD HASHING (SECURITY UPGRADE)
    # We never store plain-text passwords. generate_password_hash adds a 'salt' 
    # and hashes the password using PBKDF2 with SHA256.
    # Even if two users have the same password, their hashes will look different.
    hashed_pw = generate_password_hash(data['password'], method='pbkdf2:sha256')
    
    try:
        conn = db_manager.get_connection()
        cursor = conn.cursor()
        
        # 3. Insert the HASHED password into the database, not the raw 'data['password']'
        query = """
            INSERT INTO users (user_name, username, password, user_role, is_active) 
            VALUES (%s, %s, %s, %s, 1)
        """
        cursor.execute(query, (full_name, username, hashed_pw, data['role']))
        
        conn.commit()
        conn.close()
        
        # Return success with the generated username so the Manager can give it to the employee
        return jsonify({
            "status": "success", 
            "username": username,
            "message": "User created with secure hashed password"
        })
        
    except Exception as e:
        print(f"Error creating user: {e}")
        return jsonify({"status": "error", "message": "Could not create user"}), 500

@app.route('/api/users/toggle/<int:user_id>', methods=['POST'])
def api_toggle_user(user_id):
    """
    Endpoint to flip the active/inactive status of a staff member.
    """
    try:
        result = db_manager.toggle_user_active_status(user_id)
        if result['status'] == 'success':
            return jsonify(result), 200
        else:
            return jsonify(result), 403 # Forbidden if it's the last manager
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500

# --- SERVER START ---
if __name__ == '__main__':
    app.run(debug=True, port=5000)