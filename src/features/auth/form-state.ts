export type AuthFieldName = "email" | "password" | "passwordConfirm";

export type AuthFormValues = {
  email: string;
  password: string;
  passwordConfirm: string;
};

export type AuthFormState = {
  status: "idle" | "success" | "error";
  message?: string;
  fieldErrors?: Partial<Record<AuthFieldName, string>>;
  values: AuthFormValues;
};

const emptyValues: AuthFormValues = {
  email: "",
  password: "",
  passwordConfirm: ""
};

export const initialLoginFormState: AuthFormState = {
  status: "idle",
  values: emptyValues
};

export const initialSignUpFormState: AuthFormState = {
  status: "idle",
  values: emptyValues
};
