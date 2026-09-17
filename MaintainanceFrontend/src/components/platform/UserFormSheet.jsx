import { useMemo } from 'react';
import { useDispatch } from 'react-redux';
import { Info } from 'lucide-react';
import { useCreateUserMutation, useUpdateUserMutation } from '@/api/usersApi';
import { ResourceForm } from '@/components/common/ResourceForm/ResourceForm';
import { userDefaults, userSchema } from '@/form/schemas/user.schema';
import { FIELD_ROLES, ROLES } from '@/config/constants';
import { titleCase } from '@/helpers/format';
import { toastSuccess } from '@/redux/slices/uiSlice';

const roleOptions = ROLES.map((role) => ({ value: role, label: titleCase(role) }));

/**
 * New user / Edit user. There is no password field: a new person gets an email to choose
 * one, and a forgotten one is the reset link from the users list. An admin editing their
 * own account cannot change its role or switch it off.
 *
 * @param {{ user?: object, self?: boolean, open: boolean, onOpenChange: (open: boolean) => void }} props
 */
export function UserFormSheet({ user, self = false, open, onOpenChange }) {
  const dispatch = useDispatch();
  const [createUser] = useCreateUserMutation();
  const [updateUser] = useUpdateUserMutation();
  const editing = Boolean(user);

  const fields = useMemo(() => [
    { name: 'name', type: 'text', label: 'Name', required: true },
    { name: 'email', type: 'text', inputType: 'email', label: 'Email', required: true, span: 'half',
      description: editing ? undefined : 'The link to choose a password goes here.' },
    { name: 'phone', type: 'text', inputType: 'tel', label: 'Phone', span: 'half', placeholder: '98XXXXXXXX' },
    { name: 'role', type: 'select', label: 'Role', required: true, options: roleOptions, disabled: self,
      description: self
        ? 'You cannot change your own role.'
        : 'Roles & permissions lists what each can do. A technician or surveyor also gets a field-app profile.' },
    { name: 'isActive', type: 'switch', label: 'Can sign in', disabled: self,
      description: self ? 'You cannot switch off your own account.' : 'Switching this off signs them out everywhere.' },
  ], [editing, self]);

  const submit = async (body) => {
    // A disabled control is not sent by the form, so the admin's own role and switch are left alone.
    const payload = self ? { name: body.name, email: body.email, phone: body.phone } : body;
    if (editing) {
      const saved = await updateUser({ id: user.id, ...payload }).unwrap();
      dispatch(toastSuccess('User saved', FIELD_ROLES.includes(saved.role) && !FIELD_ROLES.includes(user.role)
        ? 'Their field-app profile is ready; set skills and areas on the technician screen.' : undefined));
    } else {
      const created = await createUser(payload).unwrap();
      dispatch(toastSuccess(`${created.name} added`, `An email to choose a password is on its way to ${created.email}.`));
    }
    onOpenChange(false);
  };

  return (
    <ResourceForm
      mode="sheet"
      open={open}
      onOpenChange={onOpenChange}
      title={editing ? `Edit ${user.name}` : 'New user'}
      description={editing ? undefined : 'They choose their own password from the email they receive.'}
      intro={editing ? null : (
        <p className="flex gap-2 rounded-lg border bg-muted/40 p-3 text-sm text-muted-foreground">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />
          Admins never set or see passwords. The link in the email works for 72 hours; after that, send a reset link.
        </p>
      )}
      schema={userSchema}
      fields={fields}
      defaultValues={editing ? { ...user, phone: user.phone ?? '' } : userDefaults}
      onSubmit={submit}
      submitLabel={editing ? 'Save user' : 'Create and send invite'}
      guard={false}
    />
  );
}
