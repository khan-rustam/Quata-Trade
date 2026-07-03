"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { AvatarStyle, UpdateProfileRequest } from "@quatatrade/shared";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { useToast } from "@/components/ui/toast";
import { AvatarPicker } from "@/components/account/avatar-picker";
import { EmailChange } from "@/components/account/email-change";
import { useMe } from "@/hooks/use-auth";
import { api } from "@/lib/api/client";
import { qk } from "@/lib/api/query-keys";
import { apiErrorMessage } from "@/lib/api/errors";

const BIO_MAX = 280;

export default function ProfilePage(): React.JSX.Element {
  const { data: me } = useMe();
  const qc = useQueryClient();
  const toast = useToast();

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [avatar, setAvatar] = useState<{ style: AvatarStyle | null; seed: string | null }>({ style: null, seed: null });
  const [saving, setSaving] = useState(false);
  const [loadedId, setLoadedId] = useState<string | null>(null);

  // Seed the form when `me` first arrives — React's "adjust state during render"
  // pattern (guarded by id), which avoids calling setState inside an effect.
  if (me && me.id !== loadedId) {
    setLoadedId(me.id);
    setFirstName(me.firstName ?? "");
    setLastName(me.lastName ?? "");
    setDisplayName(me.displayName ?? "");
    setBio(me.bio ?? "");
    setAvatar({ style: me.avatarStyle, seed: me.avatarSeed });
  }

  const submit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    if (!me || saving) return;
    const handle = displayName.trim();
    if (handle && (handle.length < 2 || handle.length > 24)) {
      toast.error("Display name must be 2–24 characters");
      return;
    }
    const body: UpdateProfileRequest = {
      displayName: handle ? handle : null,
      bio: bio.trim() ? bio.trim() : null,
      avatarStyle: avatar.style,
      avatarSeed: avatar.seed,
    };
    if (firstName.trim()) body.firstName = firstName.trim();
    if (lastName.trim()) body.lastName = lastName.trim();

    setSaving(true);
    try {
      await api.updateProfile(body);
      await qc.invalidateQueries({ queryKey: qk.me });
      toast.success("Profile updated");
    } catch (err) {
      toast.error("Could not update", apiErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto max-w-lg space-y-5">
      <PageHeader title="Profile details" backHref="/account" />
      <form onSubmit={submit} className="space-y-5" noValidate>
        <Card className="space-y-3">
          <div>
            <p className="text-sm font-medium text-text-1">Avatar</p>
            <p className="mt-0.5 text-xs text-text-3">Pick a style, then shuffle for a face you like.</p>
          </div>
          {me && <AvatarPicker userId={me.id} style={avatar.style} seed={avatar.seed} onChange={setAvatar} />}
        </Card>

        <Card className="space-y-4">
          <Field label="Display name">
            {(p) => (
              <Input
                {...p}
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="e.g. AichaTrades"
                maxLength={24}
              />
            )}
          </Field>
          <p className="-mt-2 text-xs text-text-3">
            Optional public handle shown to people you trade with. Leave blank to stay anonymous — we show a masked
            name instead.
          </p>

          <div className="grid grid-cols-2 gap-3">
            <Field label="First name">
              {(p) => <Input {...p} value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="Marie" />}
            </Field>
            <Field label="Last name">
              {(p) => <Input {...p} value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder="Nkeng" />}
            </Field>
          </div>

          <Field label="Bio">
            {(p) => (
              <textarea
                {...p}
                value={bio}
                onChange={(e) => setBio(e.target.value.slice(0, BIO_MAX))}
                rows={3}
                placeholder="A short line about you (optional)."
                className="w-full resize-none rounded-btn border border-border bg-surface-1 px-3 py-2 text-sm text-text-1 placeholder:text-text-3"
              />
            )}
          </Field>
          <p className="-mt-2 text-right text-xs text-text-3">
            {bio.length}/{BIO_MAX}
          </p>
        </Card>

        <Card className="space-y-4">
          {me && <EmailChange currentEmail={me.email} pendingEmail={me.pendingEmail} />}
          <Field label="Phone">{(p) => <Input {...p} value={me?.phone ?? "—"} disabled />}</Field>
        </Card>

        <Button type="submit" disabled={saving || !me}>
          {saving ? <Spinner /> : "Save changes"}
        </Button>
      </form>
    </div>
  );
}
