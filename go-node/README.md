# Hubble-Project

> Watch your assets move at light speed!

The hubble project is a framework to create programmable rollups with mass migration capabilities.

## Build

```bash
$ make build
```

## Install MySQL

You can either install MySQL locally or use docker.

```bash
$ docker run --name=mysql -p 3306:3306 -e MYSQL_ROOT_PASSWORD=<your-password> -d mysql
```

You might also want to install a GUI to view the database changes

```bash
$ docker run --name myadmin -d --link mysql:db -p 8080:80 phpmyadmin/phpmyadmin
```

## Initialise configration

```bash
$ make init
```

In `config.toml` you need to change the key `db_url` with your correct password

```toml
db_url="mysql://root:<your-password>@/testing?charset=utf8&parseTime=True&loc=Local"
```

In `config.toml` you also have various params for entering ethereum RPC's and contract address, do check it out!

## Run migrations

```bash
$ make migration-up
```

## Reset DB

```bash
$ make migration-down
```

## Start hubble

```bash
$ make start
```
