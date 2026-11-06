// Context plumbing shared by SJForm, SJField and SJInput (ADR-014). SJForm provides the form owner
// plus a reactive snapshot (so an Enter-position change re-renders the inputs); SJField provides
// its core parts to the SJInput inside it. Keys only: no state lives at module scope.
import type { InjectionKey, ShallowRef } from 'vue';
import type { FormOwner, FormSnapshot } from '@ramoslabs/core/form';
import type { FieldParts } from '@ramoslabs/core/field';

export interface SJFormContext {
  readonly owner: FormOwner;
  /** Reactive form snapshot: read `.value` in a render function to track registrations. */
  readonly snapshot: Readonly<ShallowRef<FormSnapshot>>;
}

export const SJ_FORM: InjectionKey<SJFormContext> = Symbol('sj-form');
export const SJ_FIELD: InjectionKey<FieldParts> = Symbol('sj-field');
