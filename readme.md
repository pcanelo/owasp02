## Laboratorio de ACL

```
docker build -t acl-example .
```

```
docker-compose up -d
```

```
sleep 30
```

```
http POST http://localhost:5000/signup user=adminuser password=helloworld
```
