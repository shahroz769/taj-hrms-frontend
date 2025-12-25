import { Button } from "@/components/ui/button";
import styles from "./DepartmentsSetups.module.css";

const departments = [
  {
    id: "dep_001",
    positionName: "Software Engineering",
    numberOfPositions: 15,
    numberOfEmployees: 12,
    creationDate: "2024-05-12",
  },
  {
    id: "dep_002",
    positionName: "Human Resources",
    numberOfPositions: 6,
    numberOfEmployees: 5,
    creationDate: "2023-11-08",
  },
  {
    id: "dep_003",
    positionName: "Marketing",
    numberOfPositions: 9,
    numberOfEmployees: 7,
    creationDate: "2024-01-15",
  },
  {
    id: "dep_004",
    positionName: "Finance",
    numberOfPositions: 8,
    numberOfEmployees: 6,
    creationDate: "2022-09-21",
  },
  {
    id: "dep_005",
    positionName: "Customer Support",
    numberOfPositions: 10,
    numberOfEmployees: 9,
    creationDate: "2023-03-10",
  },
  {
    id: "dep_006",
    positionName: "Sales",
    numberOfPositions: 12,
    numberOfEmployees: 10,
    creationDate: "2022-12-19",
  },
  {
    id: "dep_007",
    positionName: "Product Management",
    numberOfPositions: 7,
    numberOfEmployees: 6,
    creationDate: "2024-02-01",
  },
  {
    id: "dep_008",
    positionName: "DevOps",
    numberOfPositions: 6,
    numberOfEmployees: 5,
    creationDate: "2023-04-22",
  },
  {
    id: "dep_009",
    positionName: "Quality Assurance",
    numberOfPositions: 8,
    numberOfEmployees: 8,
    creationDate: "2024-07-03",
  },
  {
    id: "dep_010",
    positionName: "Research & Development",
    numberOfPositions: 5,
    numberOfEmployees: 4,
    creationDate: "2023-06-27",
  },
];

const DepartmentsSetups = () => {
  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1 className={styles.title}>Dashboard</h1>
        <Button variant="green">Add Department</Button>
      </div>
      {/* Data Table */}
      <div>
        
      </div>
    </div>
  );
};

export default DepartmentsSetups;
