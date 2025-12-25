import { Button } from "@/components/ui/button";
import { PencilIcon, TrashIcon } from "lucide-react";
import styles from "./DepartmentsSetups.module.css";
import DataTable from "@/components/DataTable/data-table";

const departments = [
  {
    id: 1,
    name: "Accounts",
    positions: "03",
    employees: "31",
    date: "12th March 25",
  },
  {
    id: 2,
    name: "Admin",
    positions: "03",
    employees: "09",
    date: "12th March 25",
  },
  {
    id: 3,
    name: "Farm Management",
    positions: "03",
    employees: "31",
    date: "12th March 25",
  },
  {
    id: 4,
    name: "Farm Labour",
    positions: "03",
    employees: "31",
    date: "12th March 25",
  },
];

const DepartmentsSetups = () => {
  const columns = [
    {
      key: "name",
      label: "Position Name",
      fontWeight: "medium",
    },
    {
      key: "positions",
      label: "Positions",
    },
    {
      key: "employees",
      label: "No. of Employees",
    },
    {
      key: "date",
      label: "Creation Date",
    },
    {
      key: "actions",
      label: "Actions",
      align: "right",
      renderEdit: () => <PencilIcon size={18} />,
      renderDelete: () => <TrashIcon size={18} />,
    },
  ];

  const handleEdit = (row) => {
    console.log("Edit:", row);
  };

  const handleDelete = (row) => {
    console.log("Delete:", row);
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1 className={styles.title}>Dashboard</h1>
        <Button variant="green">Add Department</Button>
      </div>

      <DataTable
        columns={columns}
        data={departments}
        onEdit={handleEdit}
        onDelete={handleDelete}
      />
    </div>
  );
};

export default DepartmentsSetups;
