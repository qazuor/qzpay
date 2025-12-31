---
name: react-hook-form-patterns
category: react
description: React Hook Form patterns with Zod validation for performant forms
usage: Use when building forms with validation, complex schemas, and minimal re-renders
input: Form schema, validation rules, field types
output: Form components, validation schemas, submit handlers
  validation_library: "Validation library being used"
  ui_library: "UI component library if any"
  validation_mode: "When to validate (onChange, onBlur, onSubmit)"
  default_values: "Default form values structure"
---

# React Hook Form Patterns

## ⚙️ Configuration

| Setting | Description | Example |
|---------|-------------|---------|
| `validation_library` | Schema validation library | Zod, Yup, Joi |
| `ui_library` | UI component library | Shadcn UI, Material UI, Chakra UI |
| `validation_mode` | Validation trigger | `onBlur`, `onChange`, `onSubmit` |
| `default_values` | Default form values | Empty object, populated data |

## Purpose

Build performant forms with:
- Minimal re-renders
- Type-safe validation with Zod
- Support for complex nested schemas
- Arrays with dynamic fields
- Integration with UI libraries

## Basic Form

```typescript
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

const loginSchema = z.object({
  email: z.string().email('Invalid email'),
  password: z.string().min(8, 'Min 8 characters'),
  rememberMe: z.boolean().optional(),
});

type LoginFormData = z.infer<typeof loginSchema>;

function LoginForm() {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: '',
      password: '',
      rememberMe: false,
    },
  });

  const onSubmit = async (data: LoginFormData) => {
    await loginUser(data);
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <input {...register('email')} aria-invalid={errors.email ? 'true' : 'false'} />
      {errors.email && <span role="alert">{errors.email.message}</span>}

      <input type="password" {...register('password')} />
      {errors.password && <span>{errors.password.message}</span>}

      <label>
        <input type="checkbox" {...register('rememberMe')} />
        Remember me
      </label>

      <button type="submit" disabled={isSubmitting}>
        {isSubmitting ? 'Logging in...' : 'Log in'}
      </button>
    </form>
  );
}
```

## Complex Schemas

### Nested Objects

```typescript
const userSchema = z.object({
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  address: z.object({
    street: z.string().min(1),
    city: z.string().min(1),
    zipCode: z.string().regex(/^\d{5}$/),
  }),
});

type UserFormData = z.infer<typeof userSchema>;

function UserForm() {
  const { register, formState: { errors } } = useForm<UserFormData>({
    resolver: zodResolver(userSchema),
  });

  return (
    <form>
      <input {...register('firstName')} />
      <input {...register('address.street')} />
      <input {...register('address.city')} />
      {errors.address?.street && <span>{errors.address.street.message}</span>}
    </form>
  );
}
```

### Arrays with useFieldArray

```typescript
const orderSchema = z.object({
  items: z.array(
    z.object({
      productId: z.string().min(1),
      quantity: z.number().min(1),
      notes: z.string().optional(),
    })
  ).min(1, 'At least one item required'),
});

type OrderFormData = z.infer<typeof orderSchema>;

function OrderForm() {
  const { control, register, handleSubmit, formState: { errors } } = useForm<OrderFormData>({
    resolver: zodResolver(orderSchema),
    defaultValues: {
      items: [{ productId: '', quantity: 1, notes: '' }],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: 'items',
  });

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      {fields.map((field, index) => (
        <div key={field.id}>
          <input {...register(`items.${index}.productId`)} />
          <input type="number" {...register(`items.${index}.quantity`, { valueAsNumber: true })} />
          <button type="button" onClick={() => remove(index)}>Remove</button>
          {errors.items?.[index]?.productId && (
            <span>{errors.items[index]?.productId?.message}</span>
          )}
        </div>
      ))}
      <button type="button" onClick={() => append({ productId: '', quantity: 1, notes: '' })}>
        Add Item
      </button>
      <button type="submit">Submit</button>
    </form>
  );
}
```

## Controlled Components

```typescript
import { Controller, useForm } from 'react-hook-form';
import { Select, DatePicker } from '@/components/ui';

const eventSchema = z.object({
  title: z.string().min(1),
  date: z.date(),
  category: z.enum(['meeting', 'deadline', 'reminder']),
});

function EventForm() {
  const { control, handleSubmit } = useForm({
    resolver: zodResolver(eventSchema),
  });

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <Controller
        name="date"
        control={control}
        render={({ field, fieldState: { error } }) => (
          <DatePicker
            selected={field.value}
            onChange={field.onChange}
            error={error?.message}
          />
        )}
      />

      <Controller
        name="category"
        control={control}
        render={({ field }) => (
          <Select
            value={field.value}
            onValueChange={field.onChange}
            options={[
              { label: 'Meeting', value: 'meeting' },
              { label: 'Deadline', value: 'deadline' },
            ]}
          />
        )}
      />
    </form>
  );
}
```

## UI Library Integration

```typescript
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  Form,
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
} from '@/components/ui/form';

function ProfileForm() {
  const form = useForm({
    resolver: zodResolver(profileSchema),
    defaultValues: { username: '', bio: '' },
  });

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)}>
        <FormField
          control={form.control}
          name="username"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Username</FormLabel>
              <FormControl>
                <Input placeholder="johndoe" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit">Submit</Button>
      </form>
    </Form>
  );
}
```

## Advanced Patterns

### File Upload

```typescript
const uploadSchema = z.object({
  title: z.string().min(1),
  file: z
    .instanceof(FileList)
    .refine((files) => files.length > 0, 'File required')
    .refine((files) => files[0]?.size <= 5 * 1024 * 1024, 'Max 5MB')
    .refine(
      (files) => ['image/jpeg', 'image/png'].includes(files[0]?.type),
      'Only JPEG/PNG allowed'
    ),
});

function UploadForm() {
  const { register, handleSubmit } = useForm({
    resolver: zodResolver(uploadSchema),
  });

  const onSubmit = async (data: z.infer<typeof uploadSchema>) => {
    const formData = new FormData();
    formData.append('title', data.title);
    formData.append('file', data.file[0]);
    await uploadFile(formData);
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <input {...register('title')} />
      <input type="file" {...register('file')} accept="image/jpeg,image/png" />
      <button type="submit">Upload</button>
    </form>
  );
}
```

### Async Validation

```typescript
function RegisterForm() {
  const form = useForm({
    resolver: zodResolver(registerSchema),
    mode: 'onBlur',
  });

  const validateUsername = async (username: string) => {
    const response = await fetch(`/api/check-username?username=${username}`);
    const { available } = await response.json();
    if (!available) {
      form.setError('username', {
        type: 'manual',
        message: 'Username already taken',
      });
      return false;
    }
    return true;
  };

  return (
    <form>
      <input
        {...form.register('username')}
        onBlur={(e) => validateUsername(e.target.value)}
      />
    </form>
  );
}
```

## Best Practices

| Practice | Description |
|----------|-------------|
| **Separate Schemas** | Define schemas separately for reuse and testing |
| **Type Inference** | Use `z.infer<typeof schema>` for types |
| **Validation Mode** | Use `mode: 'onBlur'` for better UX |
| **Controller for Custom** | Use Controller for controlled components |
| **useFieldArray** | Use for dynamic arrays |
| **Accessible Errors** | Show errors with accessible markup |

## When to Use

- Any React form with validation
- Complex multi-step forms
- Forms with dynamic fields
- Need minimal re-renders
- Integration with UI libraries

## Related Skills

- `error-handling-patterns` - Handle form errors
- `web-app-testing` - Test forms
- `shadcn-specialist` - Shadcn UI integration
