import { UsernamePasswordInput } from "../resolvers/UsernamePasswordInput";

export const validateRegister = (options: UsernamePasswordInput) => {
  if (!options.email.includes("@")) {
    return {
      errors: [
        {
          field: "email",
          message: "Invalid email",
        },
      ],
    };
  }

  if (options.username.length <= 2) {
    return {
      errors: [
        {
          field: "username",
          message: "Username must be at least 3 characters",
        },
      ],
    };
  }

  if (options.username.includes("@")) {
    return {
      errors: [
        {
          field: "username",
          message: "Invalid Username",
        },
      ],
    };
  }

  if (options.password.length <= 2) {
    return {
      errors: [
        {
          field: "password",
          message: "Password must be at least 3 characters",
        },
      ],
    };
  }

  return null;
};
