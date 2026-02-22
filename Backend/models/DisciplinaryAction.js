import mongoose from "mongoose";

const disciplinaryActionSchema = new mongoose.Schema(
  {
    employee: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Employee",
      required: true,
    },
    warningType: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "WarningType",
      required: true,
    },
    description: {
      type: String,
      required: true,
    },
    actionDate: {
      type: Date,
      required: true,
    },
    status: {
      type: String,
      enum: ["Active", "Inactive"],
      default: "Active",
    },
    createdBy: {
      type: String,
      default: "",
    },
  },
  { timestamps: true },
);

// Virtual field to compute remaining days (90-day active period)
disciplinaryActionSchema.virtual("remainingDays").get(function () {
  if (this.status === "Inactive") return 0;
  const now = new Date();
  const actionDate = new Date(this.actionDate);
  const expiryDate = new Date(actionDate);
  expiryDate.setDate(expiryDate.getDate() + 90);
  const diffMs = expiryDate - now;
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  return Math.max(0, diffDays);
});

// Ensure virtuals are included in JSON and Object outputs
disciplinaryActionSchema.set("toJSON", { virtuals: true });
disciplinaryActionSchema.set("toObject", { virtuals: true });

const DisciplinaryAction = mongoose.model(
  "DisciplinaryAction",
  disciplinaryActionSchema,
);

export default DisciplinaryAction;
