# Railway

## Introduction

Here's how to easily deploy this app:

- Sign up at [Railway](https://railway.app/).
- Click 'New Project' and select 'Node.js'.
- Create a Redis DB or other (Optional)
- Connect your GitHub repository
- Set your environment variables
- Add a volume to your container
- Deploy your application.
- Register an [ENS domain](https://ens.domains/) and share your app!

## Deployment

1. **Sign Up and Setup**: Create an account at [Railway](https://railway.app/) and start a new empty project.

![](create.png)

2. **Import GitHub Repository**: Click on 'Import GitHub Repository' and select the repository you want to deploy.

![](github.png)

3. **Volume**: Add a volume to your container.

![](volume.png)

4. **Database (Optional)**: Optionally, right click to add db like Redis to your project.

![](db.png)

5. **Get the redis connection string**

![](string.gif)

6. **Add the variable to the env editor in Railway.**

![](variables.png)
