module.exports = async ({ github, context, core }) => {
    try {
      const PR_ID = context.payload.pull_request.node_id;

      const linkedIssueQuery = `
        query($pr:ID!) {
          node(id: $pr) {
            ... on PullRequest {
              closingIssuesReferences(first:1, userLinkedOnly:false) {
                totalCount
                nodes {
                  id
                  number
                  projectItems(first: 5) {
                    nodes {
                      id
                      project {
                        id
                      }
                    }
                  }
                }
              }
            }
          }
        }`;

      const linkedIssueResult = await github.graphql(linkedIssueQuery, { pr: PR_ID });

      const linkedIssues = linkedIssueResult.node.closingIssuesReferences.nodes;
      if (!linkedIssues || linkedIssues.length === 0) {
        return "no linked issues!!";
      }

      const linkedIssue = linkedIssues[0]; // just the first linked issue
      const issueNumber = linkedIssue.number;
      const projectItem = linkedIssue.projectItems.nodes[0];
      const LINKED_ISSUE_ID = projectItem.id;
      const PROJECT_ID = projectItem.project.id;

      console.log(`found linked issue #${issueNumber} with project item ID: ${LINKED_ISSUE_ID}`);
      console.log(`Project ID: ${PROJECT_ID}`);

      // gett Status field
      const fieldDataQuery = `
        query($projectId:ID!) {
          node(id: $projectId) {
            ... on ProjectV2 {
              fields(first:20) {
                nodes {
                  ... on ProjectV2SingleSelectField {
                    id
                    name
                    options {
                      id
                      name
                    }
                  }
                }
              }
            }
          }
        }`;

      const fieldDataResult = await github.graphql(fieldDataQuery, { projectId: PROJECT_ID });
      const fields = fieldDataResult.node.fields.nodes;

      const statusField = fields.find(field => field.name === "Status");
      const STATUS_FIELD_ID = statusField.id;
      console.log(`status field ID: ${STATUS_FIELD_ID}`);

      let inProgressOption = statusField.options.find(option =>
        option.name === "In Progress"
      );
      const IN_PROGRESS_OPTION_ID = inProgressOption.id;

      // update the status to "In Progress"
      const updateMutation = `
        mutation($projectId:ID!, $itemId:ID!, $fieldId:ID!, $optionId:String!) {
          updateProjectV2ItemFieldValue(input: {
            projectId: $projectId,
            itemId: $itemId,
            fieldId: $fieldId,
            value: {
              singleSelectOptionId: $optionId
            }
          }) {
            projectV2Item {
              id
              updatedAt
            }
          }
        }`;

      await github.graphql(updateMutation, {
        projectId: PROJECT_ID,
        itemId: LINKED_ISSUE_ID,
        fieldId: STATUS_FIELD_ID,
        optionId: IN_PROGRESS_OPTION_ID
      });

      const message = `updated issue #${issueNumber} status to ${inProgressOption.name}`;
      console.log(message);
      return message;

    } catch (error) {
      console.error(error);
      throw error;
    }
  };
