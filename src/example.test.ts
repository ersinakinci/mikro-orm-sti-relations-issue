import {
  Collection,
  Entity,
  ManyToMany,
  ManyToOne,
  MikroORM,
  OneToMany,
  PrimaryKey,
  Property,
} from "@mikro-orm/sqlite";

@Entity()
class PrivilegeGroup {
  @PrimaryKey()
  id!: number;

  @OneToMany({ entity: () => Privilege, mappedBy: "group" })
  privileges = new Collection<Privilege>(this);

  @Property()
  name: string;

  constructor(name: string) {
    this.name = name;
  }
}

@Entity()
class Privilege {
  @PrimaryKey()
  id!: number;

  @ManyToMany({ entity: () => User, mappedBy: "privileges" })
  users = new Collection<User>(this);

  @ManyToOne({ entity: () => PrivilegeGroup })
  group!: PrivilegeGroup;

  @Property()
  name: string;

  constructor(name: string) {
    this.name = name;
  }
}

@Entity({
  discriminatorColumn: "type",
})
class User {
  @PrimaryKey()
  id!: number;

  @ManyToMany({ entity: () => Privilege })
  privileges = new Collection<Privilege>(this);

  @Property()
  name: string;

  @Property({ unique: true })
  email: string;

  constructor(name: string, email: string) {
    this.name = name;
    this.email = email;
  }
}

@Entity()
class SuperUser extends User {
  @ManyToMany({ entity: () => Privilege })
  privileges = new Collection<Privilege>(this);
}

@Entity()
class AdminUser extends User {
  @ManyToMany({ entity: () => Privilege })
  privileges = new Collection<Privilege>(this);
}

let orm: MikroORM;

beforeAll(async () => {
  // It should create a pivot table using privilege_id and user_id columns.
  // Instead, it creates a pivot table using privilege_id and admin_user_id columns.
  orm = await MikroORM.init({
    dbName: ":memory:",
    entities: [User, Privilege, PrivilegeGroup, SuperUser, AdminUser],
    debug: ["query", "query-params"],
    allowGlobalContext: true, // only for testing
  });
  await orm.schema.refreshDatabase();
});

afterAll(async () => {
  await orm.close(true);
});

test("STI collection add", async () => {
  // Create a super user
  const superUser = orm.em.create(SuperUser, { name: "Foo", email: "foo" });

  // Create a privilege group
  const privilegeGroup = orm.em.create(PrivilegeGroup, { name: "group" });

  // Create privileges and associate with the privilege group
  const privilegeRead = orm.em.create(Privilege, {
    name: "read",
    group: privilegeGroup,
  });
  const privilegeWrite = orm.em.create(Privilege, {
    name: "write",
    group: privilegeGroup,
  });

  const res = await orm.em.findOne(
    PrivilegeGroup,
    { name: "group" },
    { populate: ["privileges"] }
  );

  // It should insert into pivot table using privilege_id and user_id columns.
  // Instead, it inserts using privilege_id and super_user_id columns
  res?.privileges.map((p) => superUser.privileges.add(p));

  await orm.em.flush();
});

// test("basic CRUD example", async () => {
//   orm.em.create(User, { name: "Foo", email: "foo" });
//   await orm.em.flush();
//   orm.em.clear();

//   const user = await orm.em.findOneOrFail(User, { email: "foo" });
//   expect(user.name).toBe("Foo");
//   user.name = "Bar";
//   orm.em.remove(user);
//   await orm.em.flush();

//   const count = await orm.em.count(User, { email: "foo" });
//   expect(count).toBe(0);
// });
