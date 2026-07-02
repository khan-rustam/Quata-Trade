"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { zUpdateProfileRequest, type UpdateProfileRequest } from "@quatatrade/shared";
import { useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { useToast } from "@/components/ui/toast";
import { useMe } from "@/hooks/use-auth";
import { api } from "@/lib/api/client";
import { qk } from "@/lib/api/query-keys";
import { apiErrorMessage } from "@/lib/api/errors";

export default function ProfilePage(): React.JSX.Element {
  const { data: me } = useMe();
  const qc = useQueryClient();
  const toast = useToast();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<UpdateProfileRequest>({ resolver: zodResolver(zUpdateProfileRequest) });

  useEffect(() => {
    if (me) reset({ firstName: me.firstName ?? undefined, lastName: me.lastName ?? undefined });
  }, [me, reset]);

  const submit = handleSubmit(async (values) => {
    try {
      await api.updateProfile(values);
      await qc.invalidateQueries({ queryKey: qk.me });
      toast.success("Profile updated");
    } catch (err) {
      toast.error("Could not update", apiErrorMessage(err));
    }
  });

  return (
    <div className="mx-auto max-w-lg space-y-5">
      <PageHeader title="Profile details" backHref="/account" />
      <Card>
        <form onSubmit={submit} className="space-y-4" noValidate>
          <div className="grid grid-cols-2 gap-3">
            <Field label="First name" error={errors.firstName?.message}>
              {(p) => <Input placeholder="Marie" {...p} {...register("firstName")} />}
            </Field>
            <Field label="Last name" error={errors.lastName?.message}>
              {(p) => <Input placeholder="Nkeng" {...p} {...register("lastName")} />}
            </Field>
          </div>
          <Field label="Email">
            {(p) => <Input value={me?.email ?? ""} disabled {...p} />}
          </Field>
          <Field label="Phone">
            {(p) => <Input value={me?.phone ?? "—"} disabled {...p} />}
          </Field>
          <Button type="submit" disabled={isSubmitting || !isDirty}>
            {isSubmitting ? <Spinner /> : "Save changes"}
          </Button>
        </form>
      </Card>
    </div>
  );
}
