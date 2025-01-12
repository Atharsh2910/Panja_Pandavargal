import mysql.connector

# Database connection details
db_config = {
    'host': 'localhost',
    'user': 'root',  # Your MySQL username
    'password': '1157hemach1606^',  # Your MySQL password
    'database': 'patient_management'  # Your database name
}

def erase_all_data():
    try:
        # Establish connection to the database
        connection = mysql.connector.connect(**db_config)
        cursor = connection.cursor()

        # Disable foreign key checks temporarily
        cursor.execute("SET FOREIGN_KEY_CHECKS = 0")

        # Get all table names
        cursor.execute("SHOW TABLES")
        tables = cursor.fetchall()

        # Manually define the order of tables to ensure proper deletion
        # We will delete data from child tables first (those referencing other tables)
        tables_to_delete = [
            'DoctorVisits', 'emergency_contact', 'diagnosis', 'past_medical_conditions',
            'surgical_history', 'allergies', 'current_medications', 'upcoming_appointments', 'personal_details'
        ]

        # Generate DELETE queries for each table in the correct order
        for table in tables_to_delete:
            print(f"Erasing data from table: {table}")
            cursor.execute(f"DELETE FROM {table}")
            cursor.execute(f"ALTER TABLE {table} AUTO_INCREMENT = 1")  # Reset AUTO_INCREMENT value to 1
            connection.commit()  # Commit the transaction to erase data

        # Re-enable foreign key checks
        cursor.execute("SET FOREIGN_KEY_CHECKS = 1")

        print("All data has been erased from all tables, and the table structures are intact.")

    except mysql.connector.Error as err:
        print(f"Error: {err}")

    finally:
        # Close cursor and connection
        if cursor:
            cursor.close()
        if connection:
            connection.close()

# Run the function to erase all data
erase_all_data()
