<?php
/**
 * Employee Model
 * Handles staff records with automatic code generation based on Dept/Cat.
 */
class Employee extends Model {
    private $table = 'employees';

    public function __construct() {
        parent::__construct();
        require_once '../app/helpers/HRMSchema.php';
        HRMSchema::ensure();
    }

    public function list($q = '') {
        $sql = "
            SELECT 
                e.*, 
                d.name AS department_name, 
                d.prefix AS department_prefix,
                c.name AS category_name,
                c.prefix AS category_prefix,
                u.name AS user_account_name
            FROM {$this->table} e
            LEFT JOIN hr_departments d ON d.id = e.department_id
            LEFT JOIN hr_categories c ON c.id = e.category_id
            LEFT JOIN users u ON u.id = e.user_id
        ";

        if ($q !== '') {
            $sql .= " WHERE (e.first_name LIKE :q OR e.last_name LIKE :q OR e.employee_code LIKE :q OR e.nic LIKE :q) ";
        }
        $sql .= " ORDER BY e.employee_code ASC ";

        $this->db->query($sql);
        if ($q !== '') $this->db->bind(':q', '%' . $q . '%');
        
        return $this->db->resultSet();
    }

    public function getById($id) {
        $this->db->query("
            SELECT 
                e.*, 
                d.name AS department_name, 
                c.name AS category_name,
                u.name AS user_account_name
            FROM {$this->table} e
            LEFT JOIN hr_departments d ON d.id = e.department_id
            LEFT JOIN hr_categories c ON c.id = e.category_id
            LEFT JOIN users u ON u.id = e.user_id
            WHERE e.id = :id
            LIMIT 1
        ");
        $this->db->bind(':id', (int)$id);
        return $this->db->single();
    }

    public function generateNextCode($deptId, $catId) {
        // 1. Get Prefixes
        $this->db->query("SELECT prefix FROM hr_departments WHERE id = :id");
        $this->db->bind(':id', $deptId);
        $d = $this->db->single();
        $deptPrefix = $d ? $d->prefix : 'EMP';

        $this->db->query("SELECT prefix FROM hr_categories WHERE id = :id");
        $this->db->bind(':id', $catId);
        $c = $this->db->single();
        $catPrefix = $c ? $c->prefix : 'NA';

        $base = $deptPrefix . "-" . $catPrefix . "-";

        // 2. Find last serial for this base
        $this->db->query("
            SELECT employee_code 
            FROM {$this->table} 
            WHERE employee_code LIKE :pattern 
            ORDER BY id DESC LIMIT 1
        ");
        $this->db->bind(':pattern', $base . '%');
        $last = $this->db->single();

        $num = 1;
        if ($last) {
            $parts = explode('-', $last->employee_code);
            $lastNum = (int)end($parts);
            $num = $lastNum + 1;
        }

        return $base . str_pad($num, 3, '0', STR_PAD_LEFT);
    }

    public function create($data, $userId = null) {
        $this->db->query("
            INSERT INTO {$this->table}
            (
                employee_code, user_id, first_name, last_name, nic, dob, gender, address, phone, email, 
                nationality, religion, marital_status, blood_group, 
                emergency_contact_name, emergency_contact_phone, emergency_contact_relationship,
                passport_no, epf_no, etf_no,
                category_id, department_id, designation, joined_date, basic_salary, status, created_by
            )
            VALUES
            (
                :code, :uid, :fname, :lname, :nic, :dob, :gender, :address, :phone, :email, 
                :nat, :rel, :ms, :bg, :ecn, :ecp, :ecr, :pno, :epf, :etf,
                :cat, :dept, :desig, :joined, :salary, :status, :cb
            )
        ");
        $this->db->bind(':code', $data['employee_code']);
        $this->db->bind(':uid', $data['user_id'] ?? null);
        $this->db->bind(':fname', $data['first_name']);
        $this->db->bind(':lname', $data['last_name']);
        $this->db->bind(':nic', $data['nic'] ?? null);
        $this->db->bind(':dob', $data['dob'] ?? null);
        $this->db->bind(':gender', $data['gender'] ?? 'Other');
        $this->db->bind(':address', $data['address'] ?? null);
        $this->db->bind(':phone', $data['phone'] ?? null);
        $this->db->bind(':email', $data['email'] ?? null);
        
        // Advanced Fields
        $this->db->bind(':nat', $data['nationality'] ?? null);
        $this->db->bind(':rel', $data['religion'] ?? null);
        $this->db->bind(':ms', $data['marital_status'] ?? 'Single');
        $this->db->bind(':bg', $data['blood_group'] ?? null);
        $this->db->bind(':ecn', $data['emergency_contact_name'] ?? null);
        $this->db->bind(':ecp', $data['emergency_contact_phone'] ?? null);
        $this->db->bind(':ecr', $data['emergency_contact_relationship'] ?? null);
        $this->db->bind(':pno', $data['passport_no'] ?? null);
        $this->db->bind(':epf', $data['epf_no'] ?? null);
        $this->db->bind(':etf', $data['etf_no'] ?? null);

        $this->db->bind(':cat', $data['category_id'] ?? null);
        $this->db->bind(':dept', $data['department_id'] ?? null);
        $this->db->bind(':desig', $data['designation'] ?? null);
        $this->db->bind(':joined', $data['joined_date'] ?? null);
        $this->db->bind(':salary', $data['basic_salary'] ?? 0.00);
        $this->db->bind(':status', $data['status'] ?? 'Active');
        $this->db->bind(':cb', $userId);
        
        if ($this->db->execute()) {
            return $this->db->lastInsertId();
        }
        return false;
    }

    public function update($id, $data, $userId = null) {
        $this->db->query("
            UPDATE {$this->table}
            SET employee_code = :code,
                user_id = :uid,
                first_name = :fname,
                last_name = :lname,
                nic = :nic,
                dob = :dob,
                gender = :gender,
                address = :address,
                phone = :phone,
                email = :email,
                nationality = :nat,
                religion = :rel,
                marital_status = :ms,
                blood_group = :bg,
                emergency_contact_name = :ecn,
                emergency_contact_phone = :ecp,
                emergency_contact_relationship = :ecr,
                passport_no = :pno,
                epf_no = :epf,
                etf_no = :etf,
                category_id = :cat,
                department_id = :dept,
                designation = :desig,
                joined_date = :joined,
                basic_salary = :salary,
                status = :status,
                updated_by = :ub
            WHERE id = :id
        ");
        $this->db->bind(':code', $data['employee_code']);
        $this->db->bind(':uid', $data['user_id'] ?? null);
        $this->db->bind(':fname', $data['first_name']);
        $this->db->bind(':lname', $data['last_name']);
        $this->db->bind(':nic', $data['nic'] ?? null);
        $this->db->bind(':dob', $data['dob'] ?? null);
        $this->db->bind(':gender', $data['gender'] ?? 'Other');
        $this->db->bind(':address', $data['address'] ?? null);
        $this->db->bind(':phone', $data['phone'] ?? null);
        $this->db->bind(':email', $data['email'] ?? null);

        // Advanced Fields
        $this->db->bind(':nat', $data['nationality'] ?? null);
        $this->db->bind(':rel', $data['religion'] ?? null);
        $this->db->bind(':ms', $data['marital_status'] ?? 'Single');
        $this->db->bind(':bg', $data['blood_group'] ?? null);
        $this->db->bind(':ecn', $data['emergency_contact_name'] ?? null);
        $this->db->bind(':ecp', $data['emergency_contact_phone'] ?? null);
        $this->db->bind(':ecr', $data['emergency_contact_relationship'] ?? null);
        $this->db->bind(':pno', $data['passport_no'] ?? null);
        $this->db->bind(':epf', $data['epf_no'] ?? null);
        $this->db->bind(':etf', $data['etf_no'] ?? null);

        $this->db->bind(':cat', $data['category_id'] ?? null);
        $this->db->bind(':dept', $data['department_id'] ?? null);
        $this->db->bind(':desig', $data['designation'] ?? null);
        $this->db->bind(':joined', $data['joined_date'] ?? null);
        $this->db->bind(':salary', $data['basic_salary'] ?? 0.00);
        $this->db->bind(':status', $data['status'] ?? 'Active');
        $this->db->bind(':ub', $userId);
        $this->db->bind(':id', (int)$id);
        
        return $this->db->execute();
    }

    public function updateAvatar($id, $url) {
        $this->db->query("UPDATE {$this->table} SET avatar_url = :url WHERE id = :id");
        $this->db->bind(':url', $url);
        $this->db->bind(':id', (int)$id);
        return $this->db->execute();
    }

    public function delete($id) {
        $this->db->query("DELETE FROM {$this->table} WHERE id = :id");
        $this->db->bind(':id', (int)$id);
        return $this->db->execute();
    }
}
