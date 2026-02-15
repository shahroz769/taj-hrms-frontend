// React
import { useState } from "react";

// React Router
import { Link, useNavigate } from "react-router";

// External Libraries
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import PlusIcon from "lucide-react/dist/esm/icons/plus";
import TrashIcon from "lucide-react/dist/esm/icons/trash";
import UploadIcon from "lucide-react/dist/esm/icons/upload";
import ChevronRightIcon from "lucide-react/dist/esm/icons/chevron-right";
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
  createEmployee,
  fetchPositionsByDepartment,
} from "@/services/employeesApi";
import { fetchDepartmentsList } from "@/services/departmentsApi";

// Schema
import { employeeSchema } from "@/schemas/employeeSchema";

// Styles
import styles from "./AddEmployee.module.css";

// ============================================================================
// COMPONENT
// ============================================================================

const AddEmployee = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // ===========================================================================
  // STATE
  // ===========================================================================
  const [selectedDepartment, setSelectedDepartment] = useState("");
  const [cnicFrontPreview, setCnicFrontPreview] = useState(null);
  const [cnicBackPreview, setCnicBackPreview] = useState(null);
  const [cnicFrontFile, setCnicFrontFile] = useState(null);
  const [cnicBackFile, setCnicBackFile] = useState(null);

  // ===========================================================================
  // REACT HOOK FORM
  // ===========================================================================
  const {
    register,
    handleSubmit,
    control,
    setValue,
    watch,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(employeeSchema),
    defaultValues: {
      fullName: "",
      gender: "",
      department: "",
      position: "",
      basicSalary: "",
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
      guarantor: [{ name: "", contactNumber: "", cnic: "", address: "" }],
      legal: {
        involvedInIllegalActivity: false,
        illegalActivityDetails: "",
        convictedBefore: false,
        convictedBeforeDetails: "",
        restrictedPlaces: false,
        restrictedPlacesDetails: "",
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

  // Watch values
  const watchMedical = watch("medical");
  const watchLegal = watch("legal");

  // ===========================================================================
  // QUERIES
  // ===========================================================================

  const { data: departmentsData } = useQuery({
    queryKey: ["departmentsList"],
    queryFn: fetchDepartmentsList,
  });

  const { data: positionsData, isLoading: isLoadingPositions } = useQuery({
    queryKey: ["positionsByDepartment", selectedDepartment],
    queryFn: () => fetchPositionsByDepartment(selectedDepartment),
    enabled: !!selectedDepartment,
  });

  // ===========================================================================
  // MUTATION
  // ===========================================================================

  const mutation = useMutation({
    mutationFn: createEmployee,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["employees"] });
      toast.success("Employee created successfully");
      navigate("/workforce/employees");
    },
    onError: (error) => {
      const errorMessage =
        error.response?.data?.message || "Failed to create employee";
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

  const handleImageUpload = (e, type) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        if (type === "front") {
          setCnicFrontPreview(reader.result);
          setCnicFrontFile(file);
        } else {
          setCnicBackPreview(reader.result);
          setCnicBackFile(file);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const onSubmit = (data) => {
    const formData = new FormData();

    // Append simple fields
    Object.keys(data).forEach((key) => {
      if (
        key === "emergencyContact" ||
        key === "education" ||
        key === "previousExperience" ||
        key === "guarantor" ||
        key === "medical" ||
        key === "legal"
      ) {
        formData.append(key, JSON.stringify(data[key]));
      } else if (key !== "department") {
        formData.append(key, data[key]);
      }
    });

    // Append files
    if (cnicFrontFile) {
      formData.append("cnicFront", cnicFrontFile);
    }
    if (cnicBackFile) {
      formData.append("cnicBack", cnicBackFile);
    }

    mutation.mutate(formData);
  };

  // ===========================================================================
  // RENDER
  // ===========================================================================

  return (
    <div className={styles.container}>
      {/* Header */}
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <h1 className={styles.title}>Add Employee</h1>
        </div>
        <Button
          variant="green"
          onClick={handleSubmit(onSubmit)}
          disabled={mutation.isPending}
          className="cursor-pointer"
        >
          {mutation.isPending ? (
            <>
              <Spinner />
              Creating...
            </>
          ) : (
            "Create Employee"
          )}
        </Button>
      </div>

      <form className={styles.formContainer}>
        {/* Personal Information */}
        <div className={styles.section}>
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle}>Personal Information</h2>
          </div>
          <div className={styles.formGrid}>
            <div className={styles.formGroup}>
              <Label className={styles.label}>Full Name</Label>
              <Input {...register("fullName")} placeholder="Enter full name" />
              {errors.fullName && (
                <span className={styles.error}>{errors.fullName.message}</span>
              )}
            </div>
            <div className={styles.formGroup}>
              <Label className={styles.label}>Gender</Label>
              <Select onValueChange={(value) => setValue("gender", value)}>
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
              <Label className={styles.label}>Date of Birth</Label>
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
              <Label className={styles.label}>Father Name</Label>
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
            <div className={styles.formGroup}>
              <Label className={styles.label}>Husband Name</Label>
              <Input
                {...register("husbandName")}
                placeholder="Enter husband's name"
              />
            </div>
            <div className={styles.formGroup}>
              <Label className={styles.label}>CNIC</Label>
              <Input {...register("cnic")} placeholder="Enter CNIC number" />
              {errors.cnic && (
                <span className={styles.error}>{errors.cnic.message}</span>
              )}
            </div>
            <div className={styles.formGroup}>
              <Label className={styles.label}>Contact Number</Label>
              <Input
                {...register("contactNumber")}
                placeholder="Enter contact number"
              />
              {errors.contactNumber && (
                <span className={styles.error}>
                  {errors.contactNumber.message}
                </span>
              )}
            </div>
            <div className={styles.formGroup}>
              <Label className={styles.label}>Province</Label>
              <Input {...register("province")} placeholder="Enter province" />
              {errors.province && (
                <span className={styles.error}>{errors.province.message}</span>
              )}
            </div>
            <div className={styles.formGroup}>
              <Label className={styles.label}>City</Label>
              <Input {...register("city")} placeholder="Enter city" />
              {errors.city && (
                <span className={styles.error}>{errors.city.message}</span>
              )}
            </div>
            <div className={styles.formGroup}>
              <Label className={styles.label}>Marital Status</Label>
              <Select
                onValueChange={(value) => setValue("maritalStatus", value)}
                defaultValue="Single"
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
              <Label className={styles.label}>Department</Label>
              <Select onValueChange={handleDepartmentChange}>
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
              <Label className={styles.label}>Position</Label>
              <Select
                onValueChange={(value) => setValue("position", value)}
                disabled={!selectedDepartment || isLoadingPositions}
              >
                <SelectTrigger className="w-full">
                  <SelectValue
                    placeholder={
                      !selectedDepartment
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
              <Label className={styles.label}>Employment Type</Label>
              <Select
                onValueChange={(value) => setValue("employmentType", value)}
                defaultValue="Permanent"
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
              <Label className={styles.label}>Basic Salary</Label>
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
              <Label className={styles.label}>Joining Date</Label>
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
            <div className={`${styles.formGroup} ${styles.formGroupFull}`}>
              <Label className={styles.label}>Current Street Address</Label>
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
              <Label className={styles.label}>Permanent Street Address</Label>
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
                      <UploadIcon size={24} color="#667085" />
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
                      <UploadIcon size={24} color="#667085" />
                      <span>CNIC Back</span>
                    </>
                  )}
                </label>
              </div>
            </div>
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
                  <Label className={styles.label}>Contact Name</Label>
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
                  <Label className={styles.label}>Contact Number</Label>
                  <Input
                    {...register(`emergencyContact.${index}.number`)}
                    placeholder="Enter number"
                  />
                  {errors.emergencyContact?.[index]?.number && (
                    <span className={styles.error}>
                      {errors.emergencyContact[index].number.message}
                    </span>
                  )}
                </div>
                <div className={styles.formGroup}>
                  <Label className={styles.label}>Relation</Label>
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
            <h2 className={styles.sectionTitle}>
              Reference Information (Guarantor)
            </h2>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() =>
                appendGuarantor({
                  name: "",
                  contactNumber: "",
                  cnic: "",
                  address: "",
                })
              }
              className="cursor-pointer"
            >
              <PlusIcon size={16} />
              Add Guarantor
            </Button>
          </div>
          {guarantorFields.map((field, index) => (
            <div key={field.id} className={styles.dynamicEntry}>
              <div className={styles.dynamicEntryFields}>
                <div className={styles.formGroup}>
                  <Label className={styles.label}>Name</Label>
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
                  <Label className={styles.label}>Contact Number</Label>
                  <Input
                    {...register(`guarantor.${index}.contactNumber`)}
                    placeholder="Enter contact"
                  />
                  {errors.guarantor?.[index]?.contactNumber && (
                    <span className={styles.error}>
                      {errors.guarantor[index].contactNumber.message}
                    </span>
                  )}
                </div>
                <div className={styles.formGroup}>
                  <Label className={styles.label}>CNIC</Label>
                  <Input
                    {...register(`guarantor.${index}.cnic`)}
                    placeholder="Enter CNIC"
                  />
                  {errors.guarantor?.[index]?.cnic && (
                    <span className={styles.error}>
                      {errors.guarantor[index].cnic.message}
                    </span>
                  )}
                </div>
                <div className={styles.formGroup}>
                  <Label className={styles.label}>Address</Label>
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
          ))}
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
                  id="involvedInIllegalActivity"
                  checked={watchLegal?.involvedInIllegalActivity}
                  onCheckedChange={(checked) =>
                    setValue("legal.involvedInIllegalActivity", checked)
                  }
                />
                <Label htmlFor="involvedInIllegalActivity">
                  Have you ever been involved in any illegal activity?
                </Label>
              </div>
              {watchLegal?.involvedInIllegalActivity && (
                <Textarea
                  {...register("legal.illegalActivityDetails")}
                  placeholder="Provide details..."
                  className="mt-2"
                />
              )}
            </div>
            <div className={`${styles.formGroup} ${styles.formGroupFull}`}>
              <div className={styles.checkboxGroup}>
                <Checkbox
                  id="convictedBefore"
                  checked={watchLegal?.convictedBefore}
                  onCheckedChange={(checked) =>
                    setValue("legal.convictedBefore", checked)
                  }
                />
                <Label htmlFor="convictedBefore">
                  Have you ever been convicted before?
                </Label>
              </div>
              {watchLegal?.convictedBefore && (
                <Textarea
                  {...register("legal.convictedBeforeDetails")}
                  placeholder="Provide details..."
                  className="mt-2"
                />
              )}
            </div>
            <div className={`${styles.formGroup} ${styles.formGroupFull}`}>
              <div className={styles.checkboxGroup}>
                <Checkbox
                  id="restrictedPlaces"
                  checked={watchLegal?.restrictedPlaces}
                  onCheckedChange={(checked) =>
                    setValue("legal.restrictedPlaces", checked)
                  }
                />
                <Label htmlFor="restrictedPlaces">
                  Are you restricted from entering any places?
                </Label>
              </div>
              {watchLegal?.restrictedPlaces && (
                <Textarea
                  {...register("legal.restrictedPlacesDetails")}
                  placeholder="Provide details..."
                  className="mt-2"
                />
              )}
            </div>
          </div>
        </div>
      </form>
    </div>
  );
};

export default AddEmployee;
