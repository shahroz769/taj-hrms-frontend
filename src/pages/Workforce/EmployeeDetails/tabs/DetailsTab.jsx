// External
import { Separator } from "@/components/ui/separator";

// Utils
import { formatDate } from "@/utils/dateUtils";

// Styles
import styles from "../EmployeeDetails.module.css";

const yesNo = (v) => (v === true ? "Yes" : v === false ? "No" : "—");
const dash = (v) => (v === undefined || v === null || v === "" ? "—" : v);

const Field = ({ label, value }) => (
  <div className={styles.viewItem}>
    <span className={styles.viewLabel}>{label}</span>
    <span className={styles.viewValue}>{value ?? "—"}</span>
  </div>
);

const Section = ({ title, children }) => (
  <div>
    <div className={styles.sectionTitle}>{title}</div>
    <div className={styles.viewGrid}>{children}</div>
  </div>
);

const DetailsTab = ({ employee }) => {
  const personalFields = [
    ["Full Name", dash(employee.fullName)],
    ["Employee ID", dash(employee.employeeID)],
    ["Gender", dash(employee.gender)],
    ["Date of Birth", employee.dob ? formatDate(employee.dob) : "—"],
    ["Father Name", dash(employee.fatherName)],
    ["Husband Name", dash(employee.husbandName)],
    ["CNIC", dash(employee.cnic)],
    ["Marital Status", dash(employee.maritalStatus)],
    ["Contact Number", dash(employee.contactNumber)],
    ["Province", dash(employee.province)],
    ["City", dash(employee.city)],
    ["Employee Of", dash(employee.employeeOf)],
  ];

  const employmentFields = [
    ["Status", dash(employee.status)],
    ["Employment Type", dash(employee.employmentType)],
    ["Department", dash(employee.position?.department?.name)],
    ["Position", dash(employee.position?.name)],
    ["Joining Date", employee.joiningDate ? formatDate(employee.joiningDate) : "—"],
    [
      "Resignation Date",
      employee.resignationDate ? formatDate(employee.resignationDate) : "—",
    ],
  ];

  const addressFields = [
    ["Current Address", dash(employee.currentStreetAddress)],
    ["Permanent Address", dash(employee.permanentStreetAddress)],
  ];

  const medicalFields = [
    ["Blood Group", dash(employee.medical?.bloodGroup)],
    ["Has Health Issues", yesNo(employee.medical?.hasHealthIssues)],
    ["Health Issue Details", dash(employee.medical?.healthIssueDetails)],
    ["Disability", yesNo(employee.medical?.disability)],
    ["Disability Details", dash(employee.medical?.disabilityDetails)],
  ];

  const legalFields = [
    [
      "Convicted Criminal/Corruption Case",
      yesNo(employee.legal?.convictedCriminalCorruptionCase),
    ],
    [
      "Rusticated/Dismissed/Terminated",
      yesNo(employee.legal?.rusticatedDismissedTerminated),
    ],
    [
      "Pending Litigation/Court Case",
      yesNo(employee.legal?.pendingLitigationCourtCase),
    ],
    [
      "Available Anywhere in Pakistan",
      yesNo(employee.legal?.availableAnywhereInPakistan),
    ],
  ];

  return (
    <div className={styles.sectionGroup}>
      <Section title="Personal Information">
        {personalFields.map(([l, v]) => (
          <Field key={l} label={l} value={v} />
        ))}
      </Section>
      <Separator className={styles.sectionDivider} />

      <Section title="Employment">
        {employmentFields.map(([l, v]) => (
          <Field key={l} label={l} value={v} />
        ))}
      </Section>
      <Separator className={styles.sectionDivider} />

      <Section title="Address">
        {addressFields.map(([l, v]) => (
          <Field key={l} label={l} value={v} />
        ))}
      </Section>
      <Separator className={styles.sectionDivider} />

      <Section title="Medical">
        {medicalFields.map(([l, v]) => (
          <Field key={l} label={l} value={v} />
        ))}
      </Section>
      <Separator className={styles.sectionDivider} />

      {employee.emergencyContact?.length ? (
        <>
          <div>
            <div className={styles.sectionTitle}>Emergency Contacts</div>
            <table className={styles.subTable}>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Number</th>
                  <th>Relation</th>
                </tr>
              </thead>
              <tbody>
                {employee.emergencyContact.map((c, i) => (
                  <tr key={i}>
                    <td>{dash(c.name)}</td>
                    <td>{dash(c.number)}</td>
                    <td>{dash(c.relation)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Separator className={styles.sectionDivider} />
        </>
      ) : null}

      {employee.education?.length ? (
        <>
          <div>
            <div className={styles.sectionTitle}>Education</div>
            <table className={styles.subTable}>
              <thead>
                <tr>
                  <th>Qualification</th>
                  <th>Institute</th>
                  <th>Grades</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {employee.education.map((e, i) => (
                  <tr key={i}>
                    <td>{dash(e.qualification)}</td>
                    <td>{dash(e.institute)}</td>
                    <td>{dash(e.grades)}</td>
                    <td>{dash(e.status)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Separator className={styles.sectionDivider} />
        </>
      ) : null}

      {employee.previousExperience?.length ? (
        <>
          <div>
            <div className={styles.sectionTitle}>Previous Experience</div>
            <table className={styles.subTable}>
              <thead>
                <tr>
                  <th>Company</th>
                  <th>Position</th>
                  <th>From</th>
                  <th>To</th>
                  <th>Last Salary</th>
                </tr>
              </thead>
              <tbody>
                {employee.previousExperience.map((x, i) => (
                  <tr key={i}>
                    <td>{dash(x.company)}</td>
                    <td>{dash(x.position)}</td>
                    <td>{x.from ? formatDate(x.from) : "—"}</td>
                    <td>{x.to ? formatDate(x.to) : "—"}</td>
                    <td>
                      {x.lastSalary != null
                        ? `PKR ${Number(x.lastSalary).toLocaleString()}`
                        : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Separator className={styles.sectionDivider} />
        </>
      ) : null}

      {employee.references?.length ? (
        <>
          <div>
            <div className={styles.sectionTitle}>References</div>
            <table className={styles.subTable}>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Contact</th>
                  <th>Relation</th>
                  <th>Address</th>
                </tr>
              </thead>
              <tbody>
                {employee.references.map((r, i) => (
                  <tr key={i}>
                    <td>{dash(r.name)}</td>
                    <td>{dash(r.contactNumber)}</td>
                    <td>{dash(r.relation)}</td>
                    <td>{dash(r.address)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Separator className={styles.sectionDivider} />
        </>
      ) : null}

      {employee.guarantor?.length ? (
        <>
          <div>
            <div className={styles.sectionTitle}>Guarantor</div>
            <table className={styles.subTable}>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Contact</th>
                  <th>Relation</th>
                  <th>CNIC</th>
                  <th>Address</th>
                </tr>
              </thead>
              <tbody>
                {employee.guarantor.map((g, i) => (
                  <tr key={i}>
                    <td>{dash(g.name)}</td>
                    <td>{dash(g.contactNumber)}</td>
                    <td>{dash(g.relation)}</td>
                    <td>{dash(g.cnic)}</td>
                    <td>{dash(g.address)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Separator className={styles.sectionDivider} />
        </>
      ) : null}

      <Section title="Legal">
        {legalFields.map(([l, v]) => (
          <Field key={l} label={l} value={v} />
        ))}
      </Section>
    </div>
  );
};

export default DetailsTab;
