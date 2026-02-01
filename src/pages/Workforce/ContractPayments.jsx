import React from "react";

// React Router
import { useParams } from "react-router";

// Styles
import styles from "../Setups/DepartmentsSetups.module.css";

// ============================================================================
// COMPONENT
// ============================================================================

const ContractPayments = () => {
  const { id } = useParams();

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1 className={styles.title}>Contract Payments</h1>
      </div>

      <div className="flex flex-col items-center justify-center py-12">
        <div className="text-center">
          <h2 className="text-2xl font-semibold text-gray-700 mb-2">
            Coming Soon
          </h2>
          <p className="text-gray-500">
            Contract payment records will be available here.
          </p>
          <p className="text-sm text-gray-400 mt-2">Contract ID: {id}</p>
        </div>
      </div>
    </div>
  );
};

export default ContractPayments;
