room.topicMemory[topicKey] = {

    searchLabel: "Job",

    ask: job.title,

    image: null,

    link: jobsUrl,

    jobCard: {

        title: job.title,

        company: job.company_name,

        location: job.location,

        salary: job.detected_extensions?.salary,

        type: job.detected_extensions?.schedule_type,

        posted: job.detected_extensions?.posted_at,

        link: jobsUrl

    }

};
