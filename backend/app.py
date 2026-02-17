from flask import Flask, jsonify, request
import mysql.connector
from flask_cors import CORS

app = Flask(__name__)
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

    def fetch_user_by_credentials(self, username, password):
        # Method to find a user in the database.
        conn = self.get_connection()
        cursor = conn.cursor(dictionary=True)
        
        query = "SELECT * FROM users WHERE username = %s AND password = %s"
        cursor.execute(query, (username, password))
        result = cursor.fetchone()
        
        cursor.close()
        conn.close()
        return result
    
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

class User:
    """
    Represents a System User. 
    This allows us to treat the user as an Object rather than just a row of data.
    """
    def __init__(self, user_data):
        self.id = user_data['user_id']
        self.name = user_data['user_name']
        self.role = user_data['user_role']

    def to_dict(self):
        # Converts the object attributes into a dictionary for JSON responses.
        return {
            "status": "success",
            "user_id": self.id,
            "user_name": self.name,
            "role": self.role
        }

# --- INSTANTIATE CORE OBJECTS ---
# We create one instance of our DatabaseManager to be used by the routes
db_manager = DatabaseManager()


# --- API ROUTES ---

@app.route('/login', methods=['POST'])
def login():
    # 1. Capture the data from the Request Object
    data = request.json
    entered_username = data.get('username')
    entered_password = data.get('password')

    try:
        # 2. Use the db_manager object to find the user data
        user_record = db_manager.fetch_user_by_credentials(entered_username, entered_password)

        if user_record:
            # 3. INSTANTIATION: Create a User Object from the database results
            current_user = User(user_record)
            
            # 4. Use the object's method to return the data
            return jsonify(current_user.to_dict()), 200
        else:
            return jsonify({"status": "fail", "message": "Invalid credentials"}), 401

    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500

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
    
# --- SERVER START ---
if __name__ == '__main__':
    app.run(debug=True, port=5000)