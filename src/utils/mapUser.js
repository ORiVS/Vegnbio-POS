export function mapDjangoUser(u = {}) {
    const id = u.id ?? u._id ?? null;
    const first = u.first_name || "";
    const last = u.last_name || "";
    const name = u.name || `${first} ${last}`.trim();
    const email = u.email || "";
    const role = u.role || u.profile?.role || "";
    return { _id: id, name, email, role };
}
