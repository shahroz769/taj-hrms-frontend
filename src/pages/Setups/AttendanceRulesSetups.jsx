// React
import { useEffect, useMemo, useState } from "react";

// External Libraries
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import SaveIcon from "lucide-react/dist/esm/icons/save";
import RotateCcwIcon from "lucide-react/dist/esm/icons/rotate-ccw";
import { toast } from "sonner";

// Components
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group";
import { Spinner } from "@/components/ui/spinner";

// Services
import {
  fetchAttendanceRules,
  updateAttendanceRules,
} from "@/services/attendanceRulesApi";

// Utils
import { formatDate } from "@/utils/dateUtils";

// Styles
import styles from "./AttendanceRulesSetups.module.css";

// ============================================================================
// CONSTANTS
// ============================================================================

const RULE_FIELDS = [
  {
    key: "graceMinutes",
    label: "Grace Period",
    help: "Minutes after shift start during which a check-in is still counted as on-time. Anything beyond this is marked Late.",
    placeholder: "15",
  },
  {
    key: "earlyCheckInMinutes",
    label: "Early Check-in Window",
    help: "Maximum minutes before shift start an employee may check in and still have it counted toward that shift.",
    placeholder: "30",
  },
  {
    key: "absentAfterLateMinutes",
    label: "Absent Threshold",
    help: "Minutes after shift start beyond which the day is marked Absent, even if the employee did check in.",
    placeholder: "60",
  },
  {
    key: "halfDayEarlyCheckOutMinutes",
    label: "Half Day Early Check-out Threshold",
    help: "Minutes before shift end. If checking out earlier than this window, the day is downgraded to Half Day.",
    placeholder: "60",
  },
  {
    key: "lateCheckOutMinutes",
    label: "Late Check-out Threshold",
    help: "Minutes after shift end beyond which a check-out is flagged as a Late Check-out.",
    placeholder: "30",
  },
];

const DEFAULTS = {
  graceMinutes: 15,
  earlyCheckInMinutes: 30,
  absentAfterLateMinutes: 60,
  halfDayEarlyCheckOutMinutes: 60,
  lateCheckOutMinutes: 30,
};

// ============================================================================
// COMPONENT
// ============================================================================

const AttendanceRulesSetups = () => {
  const queryClient = useQueryClient();

  // ===========================================================================
  // STATE
  // ===========================================================================
  const [formValues, setFormValues] = useState(DEFAULTS);
  const [errors, setErrors] = useState({});

  // ===========================================================================
  // DATA FETCHING
  // ===========================================================================
  const { data, isLoading, isFetching } = useQuery({
    queryKey: ["attendance-rules"],
    queryFn: fetchAttendanceRules,
  });

  const rules = data?.rules;

  // ===========================================================================
  // EFFECTS
  // ===========================================================================
  useEffect(() => {
    if (!rules) return;
    setFormValues({
      graceMinutes: rules.graceMinutes ?? DEFAULTS.graceMinutes,
      earlyCheckInMinutes:
        rules.earlyCheckInMinutes ?? DEFAULTS.earlyCheckInMinutes,
      absentAfterLateMinutes:
        rules.absentAfterLateMinutes ?? DEFAULTS.absentAfterLateMinutes,
      halfDayEarlyCheckOutMinutes:
        rules.halfDayEarlyCheckOutMinutes ??
        DEFAULTS.halfDayEarlyCheckOutMinutes,
      lateCheckOutMinutes:
        rules.lateCheckOutMinutes ?? DEFAULTS.lateCheckOutMinutes,
    });
  }, [rules]);

  // ===========================================================================
  // MUTATIONS
  // ===========================================================================
  const updateMutation = useMutation({
    mutationFn: updateAttendanceRules,
    onSuccess: (response) => {
      toast.success(
        response?.message || "Attendance rules updated successfully",
      );
      queryClient.invalidateQueries({ queryKey: ["attendance-rules"] });
      setErrors({});
    },
    onError: (error) => {
      const message =
        error?.response?.data?.message ||
        error?.message ||
        "Failed to update attendance rules";
      setErrors({ server: message });
      toast.error(message);
    },
  });

  // ===========================================================================
  // HANDLERS
  // ===========================================================================
  const handleFieldChange = (key, value) => {
    setFormValues((prev) => ({ ...prev, [key]: value }));
    if (errors[key]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
    }
  };

  const validate = () => {
    const nextErrors = {};

    for (const { key, label } of RULE_FIELDS) {
      const raw = formValues[key];
      if (raw === "" || raw === null || raw === undefined) {
        nextErrors[key] = `${label} is required`;
        continue;
      }
      const num = Number(raw);
      if (Number.isNaN(num) || num < 0) {
        nextErrors[key] = `${label} must be a non-negative number`;
      }
      if (num > 720) {
        nextErrors[key] = `${label} must be 720 minutes or less (12 hours)`;
      }
    }

    if (
      !nextErrors.absentAfterLateMinutes &&
      !nextErrors.graceMinutes &&
      Number(formValues.absentAfterLateMinutes) <=
        Number(formValues.graceMinutes)
    ) {
      nextErrors.absentAfterLateMinutes =
        "Absent threshold must be greater than the grace period";
    }

    return nextErrors;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const nextErrors = validate();
    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }

    const payload = RULE_FIELDS.reduce((acc, { key }) => {
      acc[key] = Number(formValues[key]);
      return acc;
    }, {});

    updateMutation.mutate(payload);
  };

  const handleResetToSaved = () => {
    if (!rules) {
      setFormValues(DEFAULTS);
    } else {
      setFormValues({
        graceMinutes: rules.graceMinutes ?? DEFAULTS.graceMinutes,
        earlyCheckInMinutes:
          rules.earlyCheckInMinutes ?? DEFAULTS.earlyCheckInMinutes,
        absentAfterLateMinutes:
          rules.absentAfterLateMinutes ?? DEFAULTS.absentAfterLateMinutes,
        halfDayEarlyCheckOutMinutes:
          rules.halfDayEarlyCheckOutMinutes ??
          DEFAULTS.halfDayEarlyCheckOutMinutes,
        lateCheckOutMinutes:
          rules.lateCheckOutMinutes ?? DEFAULTS.lateCheckOutMinutes,
      });
    }
    setErrors({});
  };

  // ===========================================================================
  // DERIVED
  // ===========================================================================
  const isDirty = useMemo(() => {
    if (!rules) return false;
    return RULE_FIELDS.some(
      ({ key }) => Number(formValues[key]) !== Number(rules[key]),
    );
  }, [formValues, rules]);

  const isSaving = updateMutation.isPending;

  // ===========================================================================
  // RENDER
  // ===========================================================================
  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Attendance Rules</h1>
          <p className={styles.subtitle}>
            Configure how check-in and check-out times translate into Present,
            Late, Absent, and Half Day. These rules apply across the
            organization.
          </p>
        </div>
      </div>

      {isLoading ? (
        <div className={styles.loadingState}>
          <Spinner />
        </div>
      ) : (
        <form className={styles.formCard} onSubmit={handleSubmit}>
          <h2 className={styles.sectionTitle}>Check-in &amp; Check-out Rules</h2>
          <p className={styles.sectionHint}>
            All values are in minutes. Update with care — saved rules apply to
            all attendance computations going forward.
          </p>

          {errors.server && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
              <p className="text-sm text-red-600">{errors.server}</p>
            </div>
          )}

          <div className={styles.grid}>
            {RULE_FIELDS.map(({ key, label, help, placeholder }) => (
              <div key={key} className={styles.field}>
                <Label htmlFor={key} className="text-foreground">
                  {label}
                </Label>
                <InputGroup>
                  <InputGroupInput
                    id={key}
                    name={key}
                    type="number"
                    min={0}
                    max={720}
                    step={1}
                    inputMode="numeric"
                    placeholder={placeholder}
                    value={formValues[key] ?? ""}
                    onChange={(e) => handleFieldChange(key, e.target.value)}
                    disabled={isSaving}
                  />
                  <InputGroupAddon align="inline-end">minutes</InputGroupAddon>
                </InputGroup>
                <p className={styles.fieldHelp}>{help}</p>
                {errors[key] && (
                  <p className={styles.fieldError}>{errors[key]}</p>
                )}
              </div>
            ))}
          </div>

          <div className={styles.actions}>
            <Button
              type="button"
              variant="outline"
              className="cursor-pointer"
              onClick={handleResetToSaved}
              disabled={!isDirty || isSaving}
            >
              <RotateCcwIcon size={16} />
              Reset
            </Button>
            <Button
              type="submit"
              className="cursor-pointer"
              disabled={!isDirty || isSaving || isFetching}
            >
              {isSaving ? (
                <>
                  <Spinner className="size-4" />
                  Saving...
                </>
              ) : (
                <>
                  <SaveIcon size={16} />
                  Save Changes
                </>
              )}
            </Button>
          </div>

          {rules?.updatedAt && (
            <p className={styles.metaText}>
              Last updated on {formatDate(rules.updatedAt)}
            </p>
          )}
        </form>
      )}
    </div>
  );
};

export default AttendanceRulesSetups;
