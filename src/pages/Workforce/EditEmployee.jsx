// React
import { useEffect, useState } from "react";

// React Router
import { useNavigate, useParams } from "react-router";

// External Libraries
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import PlusIcon from "lucide-react/dist/esm/icons/plus";
import TrashIcon from "lucide-react/dist/esm/icons/trash";
import UploadIcon from "lucide-react/dist/esm/icons/upload";
import ChevronDownIcon from "lucide-react/dist/esm/icons/chevron-down";
import { toast } from "sonner";
import { format } from "date-fns";

// Components
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

// Services
import {
  fetchEmployeeById,
  updateEmployee,
  fetchPositionsByDepartment,
} from "@/services/employeesApi";
import { fetchDepartmentsList } from "@/services/departmentsApi";
import { fetchAllowanceComponentsList } from "@/services/allowanceComponentsApi";
import { fetchLeaveTypesList } from "@/services/leaveTypesApi";

// Schema
import { employeeSchema } from "@/schemas/employeeSchema";

// Styles
import styles from "./AddEmployee.module.css";

const PROVINCES = [
  "Sindh",
  "Punjab",
  "KPK",
  "Balochistan",
  "AJK",
  "Gilgit",
];
const CNIC_IMAGE_MAX_SIZE = 1 * 1024 * 1024;
const EMPLOYEE_PICTURE_MAX_SIZE = 1 * 1024 * 1024;

const sanitizeDigits = (value, maxLength) =>
  value.replace(/\D/g, "").slice(0, maxLength);

// ============================================================================
// COMPONENT
// ============================================================================

const EditEmployee = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const formId = "employee-edit-form";

  // ===========================================================================
  // STATE
  // ===========================================================================
  const [selectedDepartment, setSelectedDepartment] = useState("");
  const [employeePicturePreview, setEmployeePicturePreview] = useState(null);
  const [employeePictureFile, setEmployeePictureFile] = useState(null);
  const [employeePictureError, setEmployeePictureError] = useState("");
  const [cnicFrontPreview, setCnicFrontPreview] = useState(null);
  const [cnicBackPreview, setCnicBackPreview] = useState(null);
  const [cnicFrontFile, setCnicFrontFile] = useState(null);
  const [cnicBackFile, setCnicBackFile] = useState(null);
  const [cnicImageErrors, setCnicImageErrors] = useState({
    front: "",
    back: "",
  });
  const [isDataLoaded, setIsDataLoaded] = useState(false);

  // Reset state when employee ID changes (for navigation between different employees)
  useEffect(() => {
    setIsDataLoaded(false);
    setSelectedDepartment("");
    setEmployeePicturePreview(null);
    setEmployeePictureFile(null);
    setEmployeePictureError("");
    setCnicFrontPreview(null);
    setCnicBackPreview(null);
    setCnicFrontFile(null);
    setCnicBackFile(null);
    setCnicImageErrors({ front: "", back: "" });
  }, [id]);

  // ===========================================================================
  // REACT HOOK FORM
  // ===========================================================================
  const {
    register,
    handleSubmit,
    control,
    setValue,
    watch,
    reset,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(employeeSchema),
    defaultValues: {
      fullName: "",
      gender: "",
      department: "",
      position: "",
      employeeOf: "Taj Agri",
      basicSalary: "",
      leaveEntitlements: [],
      leaveAnnualDays: "",
      leaveMethod: "Fixed",
      allowances: [],
      compensationEffectiveDate: new Date(),
      compensationChangeReason: "",
      employmentType: "Permanent",
      fatherName: "",
      husbandName: "",
      joiningDate: new Date(),
      cnic: "",
      dob: undefined,
      contactNumber: "",
      province: "",
      city: "",
      maritalStatus: "Single",
      currentStreetAddress: "",
      permanentStreetAddress: "",
      emergencyContact: [{ name: "", number: "", relation: "" }],
      medical: {
        bloodGroup: "",
        hasHealthIssues: false,
        healthIssueDetails: "",
        disability: false,
        disabilityDetails: "",
      },
      education: [{ qualification: "", institute: "", grades: "", status: "" }],
      previousExperience: [
        {
          company: "",
          position: "",
          from: undefined,
          to: undefined,
          lastSalary: "",
        },
      ],
      guarantor: [
        { name: "", contactNumber: "", relation: "", cnic: "", address: "", documentUrl: "" },
      ],
      references: [{ name: "", contactNumber: "", relation: "", address: "" }],
      legal: {
        convictedCriminalCorruptionCase: false,
        rusticatedDismissedTerminated: false,
        pendingLitigationCourtCase: false,
        availableAnywhereInPakistan: false,
      },
    },
  });

  // Field Arrays
  const {
    fields: emergencyFields,
    append: appendEmergency,
    remove: removeEmergency,
  } = useFieldArray({
    control,
    name: "emergencyContact",
  });

  const {
    fields: educationFields,
    append: appendEducation,
    remove: removeEducation,
  } = useFieldArray({
    control,
    name: "education",
  });

  const {
    fields: experienceFields,
    append: appendExperience,
    remove: removeExperience,
  } = useFieldArray({
    control,
    name: "previousExperience",
  });

  const {
    fields: guarantorFields,
    append: appendGuarantor,
    remove: removeGuarantor,
  } = useFieldArray({
    control,
    name: "guarantor",
  });

  const {
    fields: referenceFields,
    append: appendReference,
    remove: removeReference,
  } = useFieldArray({
    control,
    name: "references",
  });

  // Per-guarantor document file state (parallel array)
  const [guarantorDocFiles, setGuarantorDocFiles] = useState([]);

  // Watch values
  const watchMedical = watch("medical");
  const watchLegal = watch("legal");
  const watchGender = watch("gender");
  const watchMaritalStatus = watch("maritalStatus");
  const watchEmployeeOf = watch("employeeOf");
  const watchLeaveEntitlements = watch("leaveEntitlements") || [];
  const watchAllowances = watch("allowances") || [];

  useEffect(() => {
    if (!(watchGender === "Female" && watchMaritalStatus === "Married")) {
      setValue("husbandName", "");
    }
  }, [setValue, watchGender, watchMaritalStatus]);

  // ===========================================================================
  // QUERIES
  // ===========================================================================

  const { data: employeeData, isLoading: isLoadingEmployee } = useQuery({
    queryKey: ["employee", id],
    queryFn: () => fetchEmployeeById(id),
    enabled: !!id,
    staleTime: 60 * 1000,
  });

  const { data: departmentsData, isLoading: isLoadingDepartments } = useQuery({
    queryKey: ["departmentsList"],
    queryFn: fetchDepartmentsList,
    staleTime: 5 * 60 * 1000,
  });

  const employee = employeeData?.employee;
  const employeeDepartmentId = employee?.position?.department?._id || "";
  const departmentIdForPositions = selectedDepartment || employeeDepartmentId;

  const { data: positionsData, isLoading: isLoadingPositions } = useQuery({
    queryKey: ["positionsByDepartment", departmentIdForPositions],
    queryFn: () => fetchPositionsByDepartment(departmentIdForPositions),
    enabled: !!departmentIdForPositions,
    staleTime: 5 * 60 * 1000,
  });

  const { data: allowanceComponentsData } = useQuery({
    queryKey: ["allowanceComponentsList"],
    queryFn: fetchAllowanceComponentsList,
    staleTime: 5 * 60 * 1000,
  });

  const { data: leaveTypesData } = useQuery({
    queryKey: ["leaveTypesList"],
    queryFn: fetchLeaveTypesList,
    staleTime: 5 * 60 * 1000,
  });

  // ===========================================================================
  // EFFECTS
  // ===========================================================================

  // Populate form with employee data as soon as the main employee payload arrives.
  // Dependent option lists can continue loading in parallel without blocking the form.
  useEffect(() => {
    if (employee && !isDataLoaded && leaveTypesData && allowanceComponentsData) {
      const emp = employee;

      // Parse dates as Date objects
      const parseDate = (dateString) => {
        if (!dateString) return undefined;
        return new Date(dateString);
      };

      // Reset form with employee data
      reset({
        fullName: emp.fullName || "",
        gender: emp.gender || "",
        department: emp.position?.department?._id || "",
        position: emp.position?._id || "",
        employeeOf: emp.employeeOf || "Taj Agri",
        basicSalary: emp.basicSalary ?? "",
        leaveEntitlements: (leaveTypesData || [])
          .filter((leaveType) => leaveType.name !== "Earned Leave")
          .map((leaveType) => {
            const existing = emp.leaveEntitlements?.find(
              (item) => item.leaveType?._id === leaveType._id,
            );
            return {
              leaveType: leaveType._id,
              enabled: Boolean(existing?.enabled),
            };
          }),
        leaveAnnualDays:
          emp.leaveEntitlements?.find((item) => item.enabled)?.annualDays ?? "",
        leaveMethod:
          emp.leaveEntitlements?.find((item) => item.enabled)?.method || "Fixed",
        allowances: (allowanceComponentsData || []).map((allowance) => {
          const existing = emp.allowances?.find(
            (item) => item.allowanceComponent?._id === allowance._id,
          );
          return {
            allowanceComponent: allowance._id,
            enabled: Boolean(existing?.enabled),
            amount: existing?.amount ?? "",
          };
        }),
        compensationEffectiveDate: new Date(),
        compensationChangeReason: "",
        employmentType: emp.employmentType || "Permanent",
        fatherName: emp.fatherName || "",
        husbandName: emp.husbandName || "",
        joiningDate: parseDate(emp.joiningDate),
        cnic: emp.cnic || "",
        dob: parseDate(emp.dob),
        contactNumber: emp.contactNumber || "",
        province: emp.province || "",
        city: emp.city || "",
        maritalStatus: emp.maritalStatus || "Single",
        currentStreetAddress: emp.currentStreetAddress || "",
        permanentStreetAddress: emp.permanentStreetAddress || "",
        emergencyContact: emp.emergencyContact?.length
          ? emp.emergencyContact
          : [{ name: "", number: "", relation: "" }],
        medical: {
          bloodGroup: emp.medical?.bloodGroup || "",
          hasHealthIssues: emp.medical?.hasHealthIssues || false,
          healthIssueDetails: emp.medical?.healthIssueDetails || "",
          disability: emp.medical?.disability || false,
          disabilityDetails: emp.medical?.disabilityDetails || "",
        },
        education: emp.education?.length
          ? emp.education
          : [{ qualification: "", institute: "", grades: "", status: "" }],
        previousExperience: emp.previousExperience?.length
          ? emp.previousExperience.map((exp) => ({
              ...exp,
              from: parseDate(exp.from),
              to: parseDate(exp.to),
            }))
          : [
              {
                company: "",
                position: "",
                from: undefined,
                to: undefined,
                lastSalary: "",
              },
            ],
        guarantor: emp.guarantor?.length
          ? emp.guarantor.map((g) => ({
              name: g.name || "",
              contactNumber: g.contactNumber || "",
              relation: g.relation || "",
              cnic: g.cnic || "",
              address: g.address || "",
              documentUrl: g.documentUrl || "",
            }))
          : [
              {
                name: "",
                contactNumber: "",
                relation: "",
                cnic: "",
                address: "",
                documentUrl: "",
              },
            ],
        references: emp.references?.length
          ? emp.references.map((r) => ({
              name: r.name || "",
              contactNumber: r.contactNumber || "",
              relation: r.relation || "",
              address: r.address || "",
            }))
          : [{ name: "", contactNumber: "", relation: "", address: "" }],
        legal: {
          convictedCriminalCorruptionCase:
            emp.legal?.convictedCriminalCorruptionCase || false,
          rusticatedDismissedTerminated:
            emp.legal?.rusticatedDismissedTerminated || false,
          pendingLitigationCourtCase:
            emp.legal?.pendingLitigationCourtCase || false,
          availableAnywhereInPakistan:
            emp.legal?.availableAnywhereInPakistan || false,
        },
      });

      // Set image previews
      setEmployeePicturePreview(emp.employeePicture || null);
      if (emp.cnicImages?.front) {
        setCnicFrontPreview(emp.cnicImages.front);
      }
      if (emp.cnicImages?.back) {
        setCnicBackPreview(emp.cnicImages.back);
      }

      setSelectedDepartment(emp.position?.department?._id || "");
      setIsDataLoaded(true);
    }
  }, [employee, reset, isDataLoaded, leaveTypesData, allowanceComponentsData]);

  // ===========================================================================
  // MUTATION
  // ===========================================================================

  const mutation = useMutation({
    mutationFn: (formData) => updateEmployee(id, formData),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["employees"] }),
        queryClient.invalidateQueries({ queryKey: ["employee", id] }),
      ]);
      toast.success("Employee updated successfully");
      navigate("/workforce/employees");
    },
    onError: (error) => {
      const errorMessage =
        error.response?.data?.message || "Failed to update employee";
      toast.error(errorMessage);
    },
  });

  // ===========================================================================
  // HANDLERS
  // ===========================================================================

  const handleDepartmentChange = (value) => {
    setSelectedDepartment(value);
    setValue("department", value);
    setValue("position", ""); // Reset position when department changes
  };

  const handleEmployeePictureUpload = (e) => {
    const file = e.target.files[0];
    if (!file) {
      return;
    }

    if (file.size > EMPLOYEE_PICTURE_MAX_SIZE) {
      const errorMessage = "Employee picture size must be 1MB or less";
      setEmployeePicturePreview(employee?.employeePicture || null);
      setEmployeePictureFile(null);
      setEmployeePictureError(errorMessage);
      e.target.value = "";
      toast.error(errorMessage);
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      setEmployeePicturePreview(reader.result);
      setEmployeePictureFile(file);
      setEmployeePictureError("");
    };
    reader.readAsDataURL(file);
  };

  const handleImageUpload = (e, type) => {
    const file = e.target.files[0];
    if (!file) {
      return;
    }

    if (file.size > CNIC_IMAGE_MAX_SIZE) {
      const errorMessage = "CNIC image size must be 1MB or less";

      setCnicImageErrors((prev) => ({
        ...prev,
        [type]: errorMessage,
      }));

      if (type === "front") {
        setCnicFrontPreview(employee?.cnicImages?.front || null);
        setCnicFrontFile(null);
      } else {
        setCnicBackPreview(employee?.cnicImages?.back || null);
        setCnicBackFile(null);
      }

      e.target.value = "";
      toast.error(errorMessage);
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      setCnicImageErrors((prev) => ({
        ...prev,
        [type]: "",
      }));

      if (type === "front") {
        setCnicFrontPreview(reader.result);
        setCnicFrontFile(file);
      } else {
        setCnicBackPreview(reader.result);
        setCnicBackFile(file);
      }
    };
    reader.readAsDataURL(file);
  };

  const onSubmit = (data) => {
    const currentBasicSalary = Number(employeeData?.employee?.basicSalary || 0);
    const nextBasicSalary = Number(data.basicSalary || 0);
    const hasCompensationChange = currentBasicSalary !== nextBasicSalary;

    if (hasCompensationChange && !data.compensationEffectiveDate) {
      toast.error("Compensation effective date is required for salary/policy changes");
      return;
    }

    const formData = new FormData();

    // Expand the single annual days + method into per-entitlement values
    const annualDays = data.leaveAnnualDays;
    const method = data.leaveMethod || "Fixed";
    const expandedEntitlements = (data.leaveEntitlements || [])
      .filter((entry) => entry.enabled)
      .map((entry) => ({
        leaveType: entry.leaveType,
        enabled: true,
        annualDays,
        method,
      }));

    // Append simple fields
    Object.keys(data).forEach((key) => {
      if (key === "leaveAnnualDays" || key === "leaveMethod") {
        return;
      }
      if (key === "leaveEntitlements") {
        formData.append("leaveEntitlements", JSON.stringify(expandedEntitlements));
        return;
      }
      if (
        key === "emergencyContact" ||
        key === "education" ||
        key === "previousExperience" ||
        key === "guarantor" ||
        key === "references" ||
        key === "medical" ||
        key === "legal" ||
        key === "allowances"
      ) {
        formData.append(key, JSON.stringify(data[key]));
      } else if (key !== "department") {
        if (key === "compensationEffectiveDate") {
          formData.append(key, data[key] ? new Date(data[key]).toISOString() : "");
        } else {
          formData.append(key, data[key]);
        }
      }
    });

    // Append files only if new ones were selected
    if (employeePictureFile) {
      formData.append("employeePicture", employeePictureFile);
    }
    if (cnicFrontFile) {
      formData.append("cnicFront", cnicFrontFile);
    }
    if (cnicBackFile) {
      formData.append("cnicBack", cnicBackFile);
    }

    // Append guarantor documents along with parallel index mapping
    const docIndices = [];
    (data.guarantor || []).forEach((_, i) => {
      const file = guarantorDocFiles[i];
      if (file instanceof File) {
        formData.append("guarantorDocuments", file);
        docIndices.push(i);
      }
    });
    if (docIndices.length > 0) {
      formData.append("guarantorDocumentIndices", JSON.stringify(docIndices));
    }

    mutation.mutate(formData);
  };

  const handleGuarantorDocUpload = (index, e) => {
    const file = e.target.files[0];
    if (!file) {
      return;
    }
    if (file.size > CNIC_IMAGE_MAX_SIZE) {
      toast.error("Guarantor document size must be 1MB or less");
      e.target.value = "";
      return;
    }
    setGuarantorDocFiles((prev) => {
      const next = [...prev];
      next[index] = file;
      return next;
    });
  };

  const renderLabel = (text, required = false) => (
    <Label className={styles.label}>
      {text}
      {required ? <span className={styles.requiredMark}> *</span> : null}
    </Label>
  );

  const renderSubmitButton = (extraProps = {}) => (
    <Button
      type="submit"
      variant="green"
      disabled={mutation.isPending}
      className="cursor-pointer"
      {...extraProps}
    >
      {mutation.isPending ? (
        <>
          <Spinner />
          Saving...
        </>
      ) : (
        "Save Changes"
      )}
    </Button>
  );

  // ===========================================================================
  // RENDER
  // ===========================================================================

  // Show loading while employee data or dependent data is loading
  const isLoadingData = isLoadingEmployee || !isDataLoaded;

  if (isLoadingData) {
    return (
      <div className={styles.container}>
        <div className="flex items-center justify-center h-64">
          <Spinner />
          <span className="ml-2">Loading employee data...</span>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      {/* Header */}
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <h1 className={styles.title}>Edit Employee</h1>
        </div>
        {renderSubmitButton({ form: formId })}
      </div>

      <form
        id={formId}
        className={styles.formContainer}
        onSubmit={handleSubmit(onSubmit)}
      >
        {/* Personal Information */}
        <div className={styles.section}>
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle}>Personal Information</h2>
          </div>
          <div className={styles.formGrid}>
            <div className={styles.formGroup}>
              {renderLabel("Full Name", true)}
              <Input {...register("fullName")} placeholder="Enter full name" />
              {errors.fullName && (
                <span className={styles.error}>{errors.fullName.message}</span>
              )}
            </div>
            <div className={styles.formGroup}>
              {renderLabel("Gender", true)}
              <Select
                value={watchGender}
                onValueChange={(value) => setValue("gender", value)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select gender" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Male">Male</SelectItem>
                  <SelectItem value="Female">Female</SelectItem>
                </SelectContent>
              </Select>
              {errors.gender && (
                <span className={styles.error}>{errors.gender.message}</span>
              )}
            </div>
            <div className={styles.formGroup}>
              {renderLabel("Date of Birth", true)}
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    data-empty={!watch("dob")}
                    className="w-full justify-between text-left font-normal data-[empty=true]:text-muted-foreground"
                  >
                    {watch("dob") ? (
                      format(watch("dob"), "PPP")
                    ) : (
                      <span>Pick a date</span>
                    )}
                    <ChevronDownIcon />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={watch("dob")}
                    onSelect={(date) => setValue("dob", date)}
                    defaultMonth={watch("dob")}
                    captionLayout="dropdown"
                    fromYear={1950}
                    toYear={new Date().getFullYear()}
                  />
                </PopoverContent>
              </Popover>
              {errors.dob && (
                <span className={styles.error}>{errors.dob.message}</span>
              )}
            </div>
            <div className={styles.formGroup}>
              {renderLabel("Father Name", true)}
              <Input
                {...register("fatherName")}
                placeholder="Enter father's name"
              />
              {errors.fatherName && (
                <span className={styles.error}>
                  {errors.fatherName.message}
                </span>
              )}
            </div>
            {watchGender === "Female" && watchMaritalStatus === "Married" ? (
              <div className={styles.formGroup}>
                {renderLabel("Husband Name", true)}
                <Input
                  {...register("husbandName")}
                  placeholder="Enter husband's name"
                />
                {errors.husbandName && (
                  <span className={styles.error}>
                    {errors.husbandName.message}
                  </span>
                )}
              </div>
            ) : null}
            <div className={styles.formGroup}>
              {renderLabel("CNIC", true)}
              <Input
                {...register("cnic")}
                inputMode="numeric"
                maxLength={13}
                placeholder="Enter 13 digit CNIC"
                onInput={(event) => {
                  event.currentTarget.value = sanitizeDigits(
                    event.currentTarget.value,
                    13,
                  );
                }}
              />
              {errors.cnic && (
                <span className={styles.error}>{errors.cnic.message}</span>
              )}
            </div>
            <div className={styles.formGroup}>
              {renderLabel("Contact Number", true)}
              <Input
                {...register("contactNumber")}
                inputMode="numeric"
                maxLength={11}
                placeholder="Enter 11 digit contact number"
                onInput={(event) => {
                  event.currentTarget.value = sanitizeDigits(
                    event.currentTarget.value,
                    11,
                  );
                }}
              />
              {errors.contactNumber && (
                <span className={styles.error}>
                  {errors.contactNumber.message}
                </span>
              )}
            </div>
            <div className={styles.formGroup}>
              {renderLabel("Province", true)}
              <Select
                value={watch("province")}
                onValueChange={(value) => setValue("province", value)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select province" />
                </SelectTrigger>
                <SelectContent>
                  {PROVINCES.map((province) => (
                    <SelectItem key={province} value={province}>
                      {province}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.province && (
                <span className={styles.error}>{errors.province.message}</span>
              )}
            </div>
            <div className={styles.formGroup}>
              {renderLabel("City", true)}
              <Input {...register("city")} placeholder="Enter city" />
              {errors.city && (
                <span className={styles.error}>{errors.city.message}</span>
              )}
            </div>
            <div className={styles.formGroup}>
              {renderLabel("Marital Status", true)}
              <Select
                value={watchMaritalStatus}
                onValueChange={(value) => setValue("maritalStatus", value)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Single">Single</SelectItem>
                  <SelectItem value="Married">Married</SelectItem>
                  <SelectItem value="Divorced">Divorced</SelectItem>
                  <SelectItem value="Widowed">Widowed</SelectItem>
                </SelectContent>
              </Select>
              {errors.maritalStatus && (
                <span className={styles.error}>
                  {errors.maritalStatus.message}
                </span>
              )}
            </div>
            <div className={styles.formGroup}>
              {renderLabel("Department", true)}
              <Select
                value={selectedDepartment}
                onValueChange={handleDepartmentChange}
                disabled={isLoadingDepartments}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select department" />
                </SelectTrigger>
                <SelectContent>
                  {departmentsData?.map((dept) => (
                    <SelectItem key={dept._id} value={dept._id}>
                      {dept.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.department && (
                <span className={styles.error}>
                  {errors.department.message}
                </span>
              )}
            </div>
            <div className={styles.formGroup}>
              {renderLabel("Position", true)}
              <Select
                value={watch("position")}
                onValueChange={(value) => setValue("position", value)}
                disabled={!departmentIdForPositions || isLoadingPositions}
              >
                <SelectTrigger className="w-full">
                  <SelectValue
                    placeholder={
                      !departmentIdForPositions
                        ? "Select department first"
                        : isLoadingPositions
                          ? "Loading..."
                          : "Select position"
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {positionsData?.positions?.map((pos) => (
                    <SelectItem key={pos._id} value={pos._id}>
                      {pos.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.position && (
                <span className={styles.error}>{errors.position.message}</span>
              )}
            </div>
            <div className={styles.formGroup}>
              {renderLabel("Employee of", true)}
              <Select
                value={watchEmployeeOf}
                onValueChange={(value) => setValue("employeeOf", value)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select company" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Taj Agri">Taj Agri</SelectItem>
                  <SelectItem value="YD">YD</SelectItem>
                </SelectContent>
              </Select>
              {errors.employeeOf && (
                <span className={styles.error}>{errors.employeeOf.message}</span>
              )}
            </div>
            <div className={styles.formGroup}>
              {renderLabel("Employee ID")}
              <Input value={employee?.employeeID || ""} readOnly />
            </div>
            <div className={styles.formGroup}>
              {renderLabel("Employment Type", true)}
              <Select
                value={watch("employmentType")}
                onValueChange={(value) => setValue("employmentType", value)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Permanent">Permanent</SelectItem>
                  <SelectItem value="Contract">Contract</SelectItem>
                  <SelectItem value="Part Time">Part Time</SelectItem>
                </SelectContent>
              </Select>
              {errors.employmentType && (
                <span className={styles.error}>
                  {errors.employmentType.message}
                </span>
              )}
            </div>
            <div className={styles.formGroup}>
              {renderLabel("Basic Salary", true)}
              <Input
                {...register("basicSalary")}
                type="number"
                min="0"
                placeholder="Enter basic salary"
              />
              {errors.basicSalary && (
                <span className={styles.error}>
                  {errors.basicSalary.message}
                </span>
              )}
            </div>
            <div className={styles.formGroup}>
              {renderLabel("Joining Date", true)}
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    data-empty={!watch("joiningDate")}
                    className="w-full justify-between text-left font-normal data-[empty=true]:text-muted-foreground"
                  >
                    {watch("joiningDate") ? (
                      format(watch("joiningDate"), "PPP")
                    ) : (
                      <span>Pick a date</span>
                    )}
                    <ChevronDownIcon />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={watch("joiningDate")}
                    onSelect={(date) => setValue("joiningDate", date)}
                    defaultMonth={watch("joiningDate")}
                    captionLayout="dropdown"
                    fromYear={1990}
                    toYear={new Date().getFullYear() + 1}
                  />
                </PopoverContent>
              </Popover>
              {errors.joiningDate && (
                <span className={styles.error}>
                  {errors.joiningDate.message}
                </span>
              )}
            </div>
            <div className={styles.formGroup}>
              {renderLabel("Compensation Effective Date")}
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    data-empty={!watch("compensationEffectiveDate")}
                    className="w-full justify-between text-left font-normal data-[empty=true]:text-muted-foreground"
                  >
                    {watch("compensationEffectiveDate") ? (
                      format(watch("compensationEffectiveDate"), "PPP")
                    ) : (
                      <span>Pick a date</span>
                    )}
                    <ChevronDownIcon />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={watch("compensationEffectiveDate")}
                    onSelect={(date) => setValue("compensationEffectiveDate", date)}
                    defaultMonth={watch("compensationEffectiveDate")}
                    captionLayout="dropdown"
                    fromYear={1990}
                    toYear={new Date().getFullYear() + 1}
                  />
                </PopoverContent>
              </Popover>
            </div>
            <div className={`${styles.formGroup} ${styles.formGroupFull}`}>
              {renderLabel("Compensation Change Reason")}
              <Textarea
                {...register("compensationChangeReason")}
                placeholder="Reason for salary/policy change (optional)"
              />
            </div>
            <div className={`${styles.formGroup} ${styles.formGroupFull}`}>
              {renderLabel("Current Street Address", true)}
              <Textarea
                {...register("currentStreetAddress")}
                placeholder="Enter current address"
              />
              {errors.currentStreetAddress && (
                <span className={styles.error}>
                  {errors.currentStreetAddress.message}
                </span>
              )}
            </div>
            <div className={`${styles.formGroup} ${styles.formGroupFull}`}>
              {renderLabel("Permanent Street Address", true)}
              <Textarea
                {...register("permanentStreetAddress")}
                placeholder="Enter permanent address"
              />
              {errors.permanentStreetAddress && (
                <span className={styles.error}>
                  {errors.permanentStreetAddress.message}
                </span>
              )}
            </div>
            <div className={`${styles.formGroup} ${styles.formGroupFull}`}>
              <Label className={styles.label}>Employee Picture (Optional)</Label>
              <div className={styles.imageUpload}>
                <label className={`${styles.imagePreview} ${styles.employeePicturePreview}`}>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleEmployeePictureUpload}
                    style={{ display: "none" }}
                  />
                  {employeePicturePreview ? (
                    <img src={employeePicturePreview} alt="Employee" />
                  ) : (
                    <>
                      <UploadIcon size={24} className="text-muted-foreground" />
                      <span>Employee Picture</span>
                    </>
                  )}
                </label>
              </div>
              <span className={styles.imageHint}>
                Upload an employee picture up to 1MB.
              </span>
              {employeePictureError ? (
                <span className={styles.error}>{employeePictureError}</span>
              ) : null}
            </div>
            <div className={`${styles.formGroup} ${styles.formGroupFull}`}>
              <Label className={styles.label}>CNIC Images</Label>
              <div className={styles.imageUpload}>
                <label className={styles.imagePreview}>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => handleImageUpload(e, "front")}
                    style={{ display: "none" }}
                  />
                  {cnicFrontPreview ? (
                    <img src={cnicFrontPreview} alt="CNIC Front" />
                  ) : (
                    <>
                      <UploadIcon size={24} className="text-muted-foreground" />
                      <span>CNIC Front</span>
                    </>
                  )}
                </label>
                <label className={styles.imagePreview}>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => handleImageUpload(e, "back")}
                    style={{ display: "none" }}
                  />
                  {cnicBackPreview ? (
                    <img src={cnicBackPreview} alt="CNIC Back" />
                  ) : (
                    <>
                      <UploadIcon size={24} className="text-muted-foreground" />
                      <span>CNIC Back</span>
                    </>
                  )}
                </label>
              </div>
              <span className={styles.imageHint}>
                Upload CNIC front/back images up to 1MB each.
              </span>
              {cnicImageErrors.front ? (
                <span className={styles.error}>{cnicImageErrors.front}</span>
              ) : null}
              {cnicImageErrors.back ? (
                <span className={styles.error}>{cnicImageErrors.back}</span>
              ) : null}
            </div>
          </div>
        </div>

        {/* Leave Entitlements */}
        <div className={styles.section}>
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle}>Leave Entitlements</h2>
          </div>
          <div className={styles.formRow}>
            <div className={styles.formGroup}>
              {renderLabel("Annual Days (applies to all selected leaves)", true)}
              <Input
                type="number"
                min="0"
                placeholder="e.g. 14"
                {...register("leaveAnnualDays")}
              />
              {errors.leaveAnnualDays ? (
                <span className={styles.error}>
                  {errors.leaveAnnualDays.message}
                </span>
              ) : null}
            </div>
            <div className={styles.formGroup}>
              {renderLabel("Method", true)}
              <Select
                value={watch("leaveMethod") || "Fixed"}
                onValueChange={(value) => setValue("leaveMethod", value)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Method" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Fixed">Fixed</SelectItem>
                  <SelectItem value="Prorata">Prorata</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className={styles.policyList}>
            {(leaveTypesData || [])
              .filter((leaveType) => leaveType.name !== "Earned Leave")
              .map((leaveType, index) => {
                const enabled = watchLeaveEntitlements[index]?.enabled;
                return (
                  <div key={leaveType._id} className={styles.checkboxGroup}>
                    <Checkbox
                      checked={Boolean(enabled)}
                      onCheckedChange={(checked) =>
                        setValue(`leaveEntitlements.${index}.enabled`, Boolean(checked))
                      }
                    />
                    <Label className={styles.label}>{leaveType.name}</Label>
                    <input
                      type="hidden"
                      {...register(`leaveEntitlements.${index}.leaveType`)}
                      value={leaveType._id}
                    />
                  </div>
                );
              })}
          </div>
        </div>

        {/* Allowances */}
        <div className={styles.section}>
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle}>Allowances</h2>
          </div>
          <div className={styles.policyList}>
            {(allowanceComponentsData || []).map((allowance, index) => {
              const enabled = watchAllowances[index]?.enabled;
              return (
                <div key={allowance._id} className={styles.policyRow}>
                  <div className={styles.checkboxGroup}>
                    <Checkbox
                      checked={Boolean(enabled)}
                      onCheckedChange={(checked) =>
                        setValue(`allowances.${index}.enabled`, Boolean(checked))
                      }
                    />
                    <Label className={styles.label}>{allowance.name}</Label>
                  </div>
                  <Input
                    type="number"
                    min="0"
                    disabled={!enabled}
                    placeholder="Monthly amount"
                    {...register(`allowances.${index}.amount`)}
                  />
                  <input
                    type="hidden"
                    {...register(`allowances.${index}.allowanceComponent`)}
                    value={allowance._id}
                  />
                </div>
              );
            })}
          </div>
        </div>

        {/* Emergency Contact Information */}
        <div className={styles.section}>
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle}>
              Emergency Contact Information
            </h2>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() =>
                appendEmergency({ name: "", number: "", relation: "" })
              }
              className="cursor-pointer"
            >
              <PlusIcon size={16} />
              Add Contact
            </Button>
          </div>
          {emergencyFields.map((field, index) => (
            <div key={field.id} className={styles.dynamicEntry}>
              <div className={styles.dynamicEntryFields3}>
                <div className={styles.formGroup}>
                  {renderLabel("Contact Name", true)}
                  <Input
                    {...register(`emergencyContact.${index}.name`)}
                    placeholder="Enter name"
                  />
                  {errors.emergencyContact?.[index]?.name && (
                    <span className={styles.error}>
                      {errors.emergencyContact[index].name.message}
                    </span>
                  )}
                </div>
                <div className={styles.formGroup}>
                  {renderLabel("Contact Number", true)}
                  <Input
                    {...register(`emergencyContact.${index}.number`)}
                    inputMode="numeric"
                    maxLength={11}
                    placeholder="Enter number"
                    onInput={(event) => {
                      event.currentTarget.value = sanitizeDigits(
                        event.currentTarget.value,
                        11,
                      );
                    }}
                  />
                  {errors.emergencyContact?.[index]?.number && (
                    <span className={styles.error}>
                      {errors.emergencyContact[index].number.message}
                    </span>
                  )}
                </div>
                <div className={styles.formGroup}>
                  {renderLabel("Relation", true)}
                  <Input
                    {...register(`emergencyContact.${index}.relation`)}
                    placeholder="Enter relation"
                  />
                  {errors.emergencyContact?.[index]?.relation && (
                    <span className={styles.error}>
                      {errors.emergencyContact[index].relation.message}
                    </span>
                  )}
                </div>
              </div>
              {emergencyFields.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeEmergency(index)}
                  className={styles.deleteBtn}
                >
                  <TrashIcon size={18} />
                </button>
              )}
            </div>
          ))}
        </div>

        {/* Medical Information */}
        <div className={styles.section}>
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle}>Medical Information</h2>
          </div>
          <div className={styles.formGrid}>
            <div className={styles.formGroup}>
              <Label className={styles.label}>Blood Group</Label>
              <Select
                value={watchMedical?.bloodGroup}
                onValueChange={(value) => setValue("medical.bloodGroup", value)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select blood group" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="A+">A+</SelectItem>
                  <SelectItem value="A-">A-</SelectItem>
                  <SelectItem value="B+">B+</SelectItem>
                  <SelectItem value="B-">B-</SelectItem>
                  <SelectItem value="O+">O+</SelectItem>
                  <SelectItem value="O-">O-</SelectItem>
                  <SelectItem value="AB+">AB+</SelectItem>
                  <SelectItem value="AB-">AB-</SelectItem>
                </SelectContent>
              </Select>
              {errors.medical?.bloodGroup && (
                <span className={styles.error}>
                  {errors.medical.bloodGroup.message}
                </span>
              )}
            </div>
            <div className={`${styles.formGroup} ${styles.formGroupFull}`}>
              <div className={styles.checkboxGroup}>
                <Checkbox
                  id="hasHealthIssues"
                  checked={watchMedical?.hasHealthIssues}
                  onCheckedChange={(checked) =>
                    setValue("medical.hasHealthIssues", checked)
                  }
                />
                <Label htmlFor="hasHealthIssues">Has Health Issues</Label>
              </div>
              {watchMedical?.hasHealthIssues && (
                <Textarea
                  {...register("medical.healthIssueDetails")}
                  placeholder="Describe health issues..."
                  className="mt-2"
                />
              )}
            </div>
            <div className={`${styles.formGroup} ${styles.formGroupFull}`}>
              <div className={styles.checkboxGroup}>
                <Checkbox
                  id="disability"
                  checked={watchMedical?.disability}
                  onCheckedChange={(checked) =>
                    setValue("medical.disability", checked)
                  }
                />
                <Label htmlFor="disability">Has Disability</Label>
              </div>
              {watchMedical?.disability && (
                <Textarea
                  {...register("medical.disabilityDetails")}
                  placeholder="Describe disability..."
                  className="mt-2"
                />
              )}
            </div>
          </div>
        </div>

        {/* Education Information */}
        <div className={styles.section}>
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle}>Education Information</h2>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() =>
                appendEducation({
                  qualification: "",
                  institute: "",
                  grades: "",
                  status: "",
                })
              }
              className="cursor-pointer"
            >
              <PlusIcon size={16} />
              Add Education
            </Button>
          </div>
          {educationFields.map((field, index) => (
            <div key={field.id} className={styles.dynamicEntry}>
              <div className={styles.dynamicEntryFields}>
                <div className={styles.formGroup}>
                  <Label className={styles.label}>Qualification</Label>
                  <Input
                    {...register(`education.${index}.qualification`)}
                    placeholder="Enter qualification"
                  />
                </div>
                <div className={styles.formGroup}>
                  <Label className={styles.label}>Institute</Label>
                  <Input
                    {...register(`education.${index}.institute`)}
                    placeholder="Enter institute"
                  />
                </div>
                <div className={styles.formGroup}>
                  <Label className={styles.label}>Grades/CGPA</Label>
                  <Input
                    {...register(`education.${index}.grades`)}
                    placeholder="Enter grades"
                  />
                </div>
                <div className={styles.formGroup}>
                  <Label className={styles.label}>Status</Label>
                  <Select
                    value={watch(`education.${index}.status`)}
                    onValueChange={(value) =>
                      setValue(`education.${index}.status`, value)
                    }
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Completed">Completed</SelectItem>
                      <SelectItem value="In Progress">In Progress</SelectItem>
                      <SelectItem value="Incomplete">Incomplete</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              {educationFields.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeEducation(index)}
                  className={styles.deleteBtn}
                >
                  <TrashIcon size={18} />
                </button>
              )}
            </div>
          ))}
        </div>

        {/* Professional Information */}
        <div className={styles.section}>
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle}>Professional Information</h2>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() =>
                appendExperience({
                  company: "",
                  position: "",
                  from: "",
                  to: "",
                  lastSalary: "",
                })
              }
              className="cursor-pointer"
            >
              <PlusIcon size={16} />
              Add Experience
            </Button>
          </div>
          {experienceFields.map((field, index) => (
            <div key={field.id} className={styles.dynamicEntry}>
              <div className={styles.dynamicEntryFields5}>
                <div className={styles.formGroup}>
                  <Label className={styles.label}>Company</Label>
                  <Input
                    {...register(`previousExperience.${index}.company`)}
                    placeholder="Enter company"
                  />
                </div>
                <div className={styles.formGroup}>
                  <Label className={styles.label}>Position</Label>
                  <Input
                    {...register(`previousExperience.${index}.position`)}
                    placeholder="Enter position"
                  />
                </div>
                <div className={styles.formGroup}>
                  <Label className={styles.label}>From</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        data-empty={!watch(`previousExperience.${index}.from`)}
                        className="w-full justify-between text-left font-normal data-[empty=true]:text-muted-foreground"
                      >
                        {watch(`previousExperience.${index}.from`) ? (
                          format(
                            watch(`previousExperience.${index}.from`),
                            "PPP",
                          )
                        ) : (
                          <span>Pick a date</span>
                        )}
                        <ChevronDownIcon />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={watch(`previousExperience.${index}.from`)}
                        onSelect={(date) =>
                          setValue(`previousExperience.${index}.from`, date)
                        }
                        defaultMonth={watch(`previousExperience.${index}.from`)}
                        captionLayout="dropdown"
                        fromYear={1990}
                        toYear={new Date().getFullYear()}
                      />
                    </PopoverContent>
                  </Popover>
                </div>
                <div className={styles.formGroup}>
                  <Label className={styles.label}>To</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        data-empty={!watch(`previousExperience.${index}.to`)}
                        className="w-full justify-between text-left font-normal data-[empty=true]:text-muted-foreground"
                      >
                        {watch(`previousExperience.${index}.to`) ? (
                          format(watch(`previousExperience.${index}.to`), "PPP")
                        ) : (
                          <span>Pick a date</span>
                        )}
                        <ChevronDownIcon />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={watch(`previousExperience.${index}.to`)}
                        onSelect={(date) =>
                          setValue(`previousExperience.${index}.to`, date)
                        }
                        defaultMonth={watch(`previousExperience.${index}.to`)}
                        captionLayout="dropdown"
                        fromYear={1990}
                        toYear={new Date().getFullYear()}
                      />
                    </PopoverContent>
                  </Popover>
                </div>
                <div className={styles.formGroup}>
                  <Label className={styles.label}>Last Salary</Label>
                  <Input
                    type="number"
                    {...register(`previousExperience.${index}.lastSalary`)}
                    placeholder="Enter salary"
                  />
                </div>
              </div>
              {experienceFields.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeExperience(index)}
                  className={styles.deleteBtn}
                >
                  <TrashIcon size={18} />
                </button>
              )}
            </div>
          ))}
        </div>

        {/* Reference Information */}
        <div className={styles.section}>
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle}>Reference Information</h2>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() =>
                appendReference({
                  name: "",
                  contactNumber: "",
                  relation: "",
                  address: "",
                })
              }
              className="cursor-pointer"
            >
              <PlusIcon size={16} />
              Add Reference
            </Button>
          </div>
          {referenceFields.map((field, index) => (
            <div key={field.id} className={styles.dynamicEntry}>
              <div className={styles.dynamicEntryFields}>
                <div className={styles.formGroup}>
                  {renderLabel("Name", true)}
                  <Input
                    {...register(`references.${index}.name`)}
                    placeholder="Enter name"
                  />
                  {errors.references?.[index]?.name && (
                    <span className={styles.error}>
                      {errors.references[index].name.message}
                    </span>
                  )}
                </div>
                <div className={styles.formGroup}>
                  {renderLabel("Contact Number", true)}
                  <Input
                    {...register(`references.${index}.contactNumber`)}
                    inputMode="numeric"
                    maxLength={11}
                    placeholder="Enter contact"
                    onInput={(event) => {
                      event.currentTarget.value = sanitizeDigits(
                        event.currentTarget.value,
                        11,
                      );
                    }}
                  />
                  {errors.references?.[index]?.contactNumber && (
                    <span className={styles.error}>
                      {errors.references[index].contactNumber.message}
                    </span>
                  )}
                </div>
                <div className={styles.formGroup}>
                  {renderLabel("Relation", true)}
                  <Input
                    {...register(`references.${index}.relation`)}
                    placeholder="e.g. Friend, Colleague"
                  />
                  {errors.references?.[index]?.relation && (
                    <span className={styles.error}>
                      {errors.references[index].relation.message}
                    </span>
                  )}
                </div>
                <div className={styles.formGroup}>
                  {renderLabel("Address", true)}
                  <Input
                    {...register(`references.${index}.address`)}
                    placeholder="Enter address"
                  />
                  {errors.references?.[index]?.address && (
                    <span className={styles.error}>
                      {errors.references[index].address.message}
                    </span>
                  )}
                </div>
              </div>
              {referenceFields.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeReference(index)}
                  className={styles.deleteBtn}
                >
                  <TrashIcon size={18} />
                </button>
              )}
            </div>
          ))}
        </div>

        {/* Guarantor */}
        <div className={styles.section}>
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle}>Guarantor</h2>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() =>
                appendGuarantor({
                  name: "",
                  contactNumber: "",
                  relation: "",
                  cnic: "",
                  address: "",
                  documentUrl: "",
                })
              }
              className="cursor-pointer"
            >
              <PlusIcon size={16} />
              Add Guarantor
            </Button>
          </div>
          {guarantorFields.map((field, index) => {
            const existingDocUrl = watch(`guarantor.${index}.documentUrl`);
            const newDocFile = guarantorDocFiles[index];
            return (
              <div key={field.id} className={styles.dynamicEntry}>
                <div className={styles.dynamicEntryFields}>
                  <div className={styles.formGroup}>
                    {renderLabel("Name", true)}
                    <Input
                      {...register(`guarantor.${index}.name`)}
                      placeholder="Enter name"
                    />
                    {errors.guarantor?.[index]?.name && (
                      <span className={styles.error}>
                        {errors.guarantor[index].name.message}
                      </span>
                    )}
                  </div>
                  <div className={styles.formGroup}>
                    {renderLabel("Contact Number", true)}
                    <Input
                      {...register(`guarantor.${index}.contactNumber`)}
                      inputMode="numeric"
                      maxLength={11}
                      placeholder="Enter contact"
                      onInput={(event) => {
                        event.currentTarget.value = sanitizeDigits(
                          event.currentTarget.value,
                          11,
                        );
                      }}
                    />
                    {errors.guarantor?.[index]?.contactNumber && (
                      <span className={styles.error}>
                        {errors.guarantor[index].contactNumber.message}
                      </span>
                    )}
                  </div>
                  <div className={styles.formGroup}>
                    {renderLabel("Relation", true)}
                    <Input
                      {...register(`guarantor.${index}.relation`)}
                      placeholder="e.g. Brother, Father"
                    />
                    {errors.guarantor?.[index]?.relation && (
                      <span className={styles.error}>
                        {errors.guarantor[index].relation.message}
                      </span>
                    )}
                  </div>
                  <div className={styles.formGroup}>
                    {renderLabel("CNIC", true)}
                    <Input
                      {...register(`guarantor.${index}.cnic`)}
                      inputMode="numeric"
                      maxLength={13}
                      placeholder="Enter CNIC"
                      onInput={(event) => {
                        event.currentTarget.value = sanitizeDigits(
                          event.currentTarget.value,
                          13,
                        );
                      }}
                    />
                    {errors.guarantor?.[index]?.cnic && (
                      <span className={styles.error}>
                        {errors.guarantor[index].cnic.message}
                      </span>
                    )}
                  </div>
                  <div className={styles.formGroup}>
                    {renderLabel("Address", true)}
                    <Input
                      {...register(`guarantor.${index}.address`)}
                      placeholder="Enter address"
                    />
                    {errors.guarantor?.[index]?.address && (
                      <span className={styles.error}>
                        {errors.guarantor[index].address.message}
                      </span>
                    )}
                  </div>
                  <div className={styles.formGroup}>
                    {renderLabel("Relevant Document")}
                    <Input
                      type="file"
                      accept="image/jpeg,image/jpg,image/png,image/webp"
                      onChange={(e) => handleGuarantorDocUpload(index, e)}
                    />
                    {newDocFile?.name ? (
                      <span className={styles.imageHint}>
                        New: {newDocFile.name}
                      </span>
                    ) : existingDocUrl ? (
                      <a
                        href={existingDocUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={styles.imageHint}
                      >
                        View existing document
                      </a>
                    ) : (
                      <span className={styles.imageHint}>
                        Image up to 1MB (JPG, PNG, WebP)
                      </span>
                    )}
                  </div>
                </div>
                {guarantorFields.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeGuarantor(index)}
                    className={styles.deleteBtn}
                  >
                    <TrashIcon size={18} />
                  </button>
                )}
              </div>
            );
          })}
        </div>

        {/* Legal Information */}
        <div className={styles.section}>
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle}>Legal Information</h2>
          </div>
          <div className={styles.formGrid}>
            <div className={`${styles.formGroup} ${styles.formGroupFull}`}>
              <div className={styles.checkboxGroup}>
                <Checkbox
                  id="convictedCriminalCorruptionCase"
                  checked={watchLegal?.convictedCriminalCorruptionCase}
                  onCheckedChange={(checked) =>
                    setValue("legal.convictedCriminalCorruptionCase", checked)
                  }
                />
                <Label htmlFor="convictedCriminalCorruptionCase">
                  Have you ever been convicted in any criminal/corruption case?
                </Label>
              </div>
            </div>
            <div className={`${styles.formGroup} ${styles.formGroupFull}`}>
              <div className={styles.checkboxGroup}>
                <Checkbox
                  id="rusticatedDismissedTerminated"
                  checked={watchLegal?.rusticatedDismissedTerminated}
                  onCheckedChange={(checked) =>
                    setValue("legal.rusticatedDismissedTerminated", checked)
                  }
                />
                <Label htmlFor="rusticatedDismissedTerminated">
                  Have you ever been rusticated / dismissed or terminated?
                </Label>
              </div>
            </div>
            <div className={`${styles.formGroup} ${styles.formGroupFull}`}>
              <div className={styles.checkboxGroup}>
                <Checkbox
                  id="pendingLitigationCourtCase"
                  checked={watchLegal?.pendingLitigationCourtCase}
                  onCheckedChange={(checked) =>
                    setValue("legal.pendingLitigationCourtCase", checked)
                  }
                />
                <Label htmlFor="pendingLitigationCourtCase">
                  Do you have any litigation or court case pending against you at present?
                </Label>
              </div>
            </div>
            <div className={`${styles.formGroup} ${styles.formGroupFull}`}>
              <div className={styles.checkboxGroup}>
                <Checkbox
                  id="availableAnywhereInPakistan"
                  checked={watchLegal?.availableAnywhereInPakistan}
                  onCheckedChange={(checked) =>
                    setValue("legal.availableAnywhereInPakistan", checked)
                  }
                />
                <Label htmlFor="availableAnywhereInPakistan">
                  Are you available to work anywhere in Pakistan?
                </Label>
              </div>
            </div>
          </div>
        </div>
        <div className={styles.formActions}>{renderSubmitButton()}</div>
      </form>
    </div>
  );
};

export default EditEmployee;
